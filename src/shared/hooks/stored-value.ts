import { useSyncExternalStore } from 'react'
import type { z } from 'zod'

import { readStorage, removeStorage, writeStorage } from '@/shared/lib/storage'

/**
 * A small device-local value in Web Storage with Zod validation and a React hook
 * (useSyncExternalStore, updated across tabs). For per-device state only — never server data.
 */
export function createStoredValue<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
  kind: 'local' | 'session' = 'local',
) {
  const listeners = new Set<() => void>()
  let cached: { raw: string | null; value: T } | null = null

  function get(): T {
    const raw = readStorage(key, kind)
    if (cached && cached.raw === raw) return cached.value
    let value = fallback
    if (raw !== null) {
      try {
        const result = schema.safeParse(JSON.parse(raw))
        if (result.success) value = result.data
      } catch {
        value = fallback
      }
    }
    cached = { raw, value }
    return value
  }

  function emit() {
    for (const listener of listeners) listener()
  }

  function set(value: T) {
    writeStorage(key, JSON.stringify(value), kind)
    emit()
  }

  function clear() {
    removeStorage(key, kind)
    emit()
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }

  function useValue() {
    return useSyncExternalStore(subscribe, get, () => fallback)
  }

  return { key, get, set, clear, subscribe, useValue }
}

export type StoredValue<T> = ReturnType<typeof createStoredValue<T>>
