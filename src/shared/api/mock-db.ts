import type { z } from 'zod'

import { readStorage, removeStorage, storageKeys, writeStorage } from '@/shared/lib/storage'

import { AppError, type AppErrorCode } from './errors'

/**
 * Domain-agnostic document store that plays the database for the mock backend (ADR 0015).
 * Every table is one localStorage entry (`kasif:mockdb:v1:<table>`), parsed with the caller's
 * Zod schema on read — the same boundary validation the Supabase adapters do.
 */
export const MOCK_DB_PREFIX = 'kasif:mockdb:v1:'

type Listener = () => void
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith(MOCK_DB_PREFIX)) notify()
  })
}

/**
 * Typed reader with write-through caching: storage is re-parsed only when its raw string
 * changed (another tab, a test fixture, an import).
 */
function createEntry<T>(key: string, parse: (raw: unknown) => T, fallback: () => T) {
  let cached: { raw: string | null; value: T } | null = null

  return {
    read(): T {
      const raw = readStorage(key)
      if (cached && cached.raw === raw) return cached.value
      let value = fallback()
      if (raw !== null) {
        try {
          value = parse(JSON.parse(raw))
        } catch {
          value = fallback()
        }
      }
      cached = { raw, value }
      return value
    },
    write(value: T) {
      const raw = JSON.stringify(value)
      if (!writeStorage(key, raw)) {
        throw new AppError(
          'storage_full',
          'Deneme ortamının tarayıcı depolama alanı doldu. Ayarlar → “Deneme verisini sıfırla” ile yer açabilirsiniz.',
        )
      }
      cached = { raw, value }
      notify()
    },
    remove() {
      removeStorage(key)
      cached = null
      notify()
    },
  }
}

export type MockTable<T> = {
  all(): T[]
  find(predicate: (row: T) => boolean): T | undefined
  filter(predicate: (row: T) => boolean): T[]
  insert(row: T): T
  insertMany(rows: readonly T[]): void
  /** Replaces the rows matching `predicate` with `update(row)`; returns the updated rows. */
  update(predicate: (row: T) => boolean, update: (row: T) => T): T[]
  /** Inserts or replaces the row with the same key. */
  upsert(row: T, key: (row: T) => string): T
  remove(predicate: (row: T) => boolean): number
  replaceAll(rows: readonly T[]): void
  count(predicate?: (row: T) => boolean): number
}

/** A typed table. Rows that no longer match the schema are skipped instead of crashing. */
export function mockTable<T>(name: string, schema: z.ZodType<T>): MockTable<T> {
  const entry = createEntry<T[]>(
    `${MOCK_DB_PREFIX}${name}`,
    (raw) => {
      if (!Array.isArray(raw)) return []
      const rows: T[] = []
      for (const item of raw) {
        const result = schema.safeParse(item)
        if (result.success) rows.push(result.data)
      }
      return rows
    },
    () => [],
  )
  const all = () => entry.read()

  return {
    all,
    find: (predicate) => all().find(predicate),
    filter: (predicate) => all().filter(predicate),
    insert(row) {
      entry.write([...all(), row])
      return row
    },
    insertMany(rows) {
      if (rows.length > 0) entry.write([...all(), ...rows])
    },
    update(predicate, update) {
      const updated: T[] = []
      const next = all().map((row) => {
        if (!predicate(row)) return row
        const changed = update(row)
        updated.push(changed)
        return changed
      })
      if (updated.length > 0) entry.write(next)
      return updated
    },
    upsert(row, keyOf) {
      const id = keyOf(row)
      const rows = all()
      const index = rows.findIndex((existing) => keyOf(existing) === id)
      entry.write(
        index === -1 ? [...rows, row] : rows.map((existing, i) => (i === index ? row : existing)),
      )
      return row
    },
    remove(predicate) {
      const rows = all()
      const next = rows.filter((row) => !predicate(row))
      if (next.length !== rows.length) entry.write(next)
      return rows.length - next.length
    },
    replaceAll(rows) {
      entry.write([...rows])
    },
    count: (predicate) => (predicate ? all().filter(predicate).length : all().length),
  }
}

export type MockDoc<T> = {
  get(): T | undefined
  set(value: T): void
  remove(): void
}

/** A single typed document (published files, settings …). */
export function mockDoc<T>(name: string, schema: z.ZodType<T>): MockDoc<T> {
  const entry = createEntry<T | undefined>(
    `${MOCK_DB_PREFIX}doc:${name}`,
    (raw) => {
      const result = schema.safeParse(raw)
      return result.success ? result.data : undefined
    },
    () => undefined,
  )
  return {
    get: () => entry.read(),
    set: (value) => entry.write(value),
    remove: () => entry.remove(),
  }
}

export function subscribeMockDb(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export type MockDbDump = Record<string, string>

export function exportMockDb(): MockDbDump {
  const dump: MockDbDump = {}
  for (const key of storageKeys(MOCK_DB_PREFIX)) {
    const raw = readStorage(key)
    if (raw !== null) dump[key] = raw
  }
  return dump
}

export function importMockDb(dump: MockDbDump) {
  for (const key of storageKeys(MOCK_DB_PREFIX)) removeStorage(key)
  for (const [key, raw] of Object.entries(dump)) {
    if (key.startsWith(MOCK_DB_PREFIX)) writeStorage(key, raw)
  }
  notify()
}

export function resetMockDb() {
  for (const key of storageKeys(MOCK_DB_PREFIX)) removeStorage(key)
  notify()
}

/** Approximate bytes the mock database uses (UTF-16 → 2 bytes per char). */
export function mockDbSize() {
  return storageKeys(MOCK_DB_PREFIX).reduce(
    (sum, key) => sum + (readStorage(key)?.length ?? 0) * 2,
    0,
  )
}

// ---------------------------------------------------------------------------------------------
// Test controls: latency, one-shot failures and "hold until released" gates per operation.
// ---------------------------------------------------------------------------------------------

type Hold = { promise: Promise<void>; release: () => void }

function noop() {}

const failures = new Map<string, AppError>()
const holds = new Map<string, Hold>()
let latencyMs = Number(readStorage('kasif:mock:latency') ?? '0') || 0

export const mockControl = {
  setLatency(ms: number) {
    latencyMs = Math.max(0, ms)
  },
  /** The next call of `operation` throws. */
  failNext(operation: string, code: AppErrorCode, message?: string) {
    failures.set(operation, new AppError(code, message))
  },
  /** Calls of `operation` wait until `release(operation)` — for asserting loading states. */
  hold(operation: string) {
    if (holds.has(operation)) return
    // The executor runs synchronously, so `release` is replaced before it can be called.
    let release: () => void = noop
    const promise = new Promise<void>((resolve) => {
      release = resolve
    })
    holds.set(operation, { promise, release })
  },
  release(operation: string) {
    holds.get(operation)?.release()
    holds.delete(operation)
  },
  reset() {
    failures.clear()
    for (const hold of holds.values()) hold.release()
    holds.clear()
  },
}

/** Every mock adapter call goes through here first. */
export async function mockGate(operation: string) {
  if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
  const hold = holds.get(operation)
  if (hold) await hold.promise
  const failure = failures.get(operation)
  if (failure) {
    failures.delete(operation)
    throw failure
  }
}
