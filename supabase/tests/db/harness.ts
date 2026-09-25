import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import pg from 'pg'

/*
 * Database test harness (ADR 0016, "Plan 3 · Prova"). The same suites run
 *   - locally on PGlite (Postgres in WebAssembly) with a minimal Supabase stub, no Docker, and
 *   - in CI against the real local stack (`supabase start`) when TEST_DB_URL is set.
 * Every test runs inside one transaction that is rolled back afterwards, so tests never see each
 * other's rows and the CI database stays clean. The live project is never a target: TEST_DB_URL
 * must point at localhost.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS = path.resolve(HERE, '../../migrations')

type Row = Record<string, unknown>
type Query = (text: string, params?: readonly unknown[]) => Promise<Row[]>

export type Actor =
  | { kind: 'anon' }
  | { kind: 'service' }
  | { kind: 'user'; id: string; anonymous: boolean; aal: 'aal1' | 'aal2' }

/** Error thrown by the database, with the SQLSTATE and the JSON detail of private.raise(). */
export class DbError extends Error {
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

function toDbError(error: unknown) {
  if (typeof error !== 'object' || error === null) return error
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = error instanceof Error ? error.message : String(error)
  let details: Record<string, unknown> = {}
  if ('detail' in error && typeof error.detail === 'string') {
    try {
      const parsed: unknown = JSON.parse(error.detail)
      if (typeof parsed === 'object' && parsed !== null) details = { ...parsed }
    } catch {
      details = { detail: error.detail }
    }
  }
  return new DbError(code, message, details)
}

function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .toSorted()
    .map((file) => readFileSync(path.join(MIGRATIONS, file), 'utf8'))
}

async function openPglite(): Promise<{ query: Query; close: () => Promise<void> }> {
  const db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec(readFileSync(path.join(HERE, 'supabase-stubs.sql'), 'utf8'))
  // oxlint-disable-next-line no-await-in-loop -- migrations apply in order
  for (const sql of migrationFiles()) await db.exec(sql)
  return {
    query: async (text, params = []) => (await db.query<Row>(text, [...params])).rows,
    close: () => db.close(),
  }
}

async function openPostgres(url: string): Promise<{ query: Query; close: () => Promise<void> }> {
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Database tests run on the local stack only (got ${host}).`)
  }
  // oxlint-disable-next-line import/no-named-as-default-member -- pg is CommonJS: Client lives on the default export
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  return {
    query: async (text, params = []) => (await client.query<Row>(text, [...params])).rows,
    close: () => client.end(),
  }
}

function claimsOf(actor: Actor) {
  switch (actor.kind) {
    case 'anon':
      return { role: 'anon' }
    case 'service':
      return { role: 'service_role' }
    default:
      return {
        sub: actor.id,
        role: 'authenticated',
        is_anonymous: actor.anonymous,
        aal: actor.aal,
      }
  }
}

function roleOf(actor: Actor) {
  return actor.kind === 'anon'
    ? 'anon'
    : actor.kind === 'service'
      ? 'service_role'
      : 'authenticated'
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

export async function createTestDb() {
  const url = process.env['TEST_DB_URL']
  const { query, close } = url ? await openPostgres(url) : await openPglite()
  let savepoint = 0

  /** Runs `text` as `actor` (role + JWT claims), isolated in a savepoint. */
  async function run(actor: Actor, text: string, params: readonly unknown[] = []) {
    const name = `call_${++savepoint}`
    await query(`savepoint ${name}`)
    try {
      await query(`set local role ${roleOf(actor)}`)
      await query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(claimsOf(actor)),
      ])
      const rows = await query(text, params)
      await query('reset role')
      await query(`release savepoint ${name}`)
      return rows
    } catch (error) {
      await query(`rollback to savepoint ${name}`)
      await query('reset role')
      throw toDbError(error)
    }
  }

  const db = {
    /** As the migration owner (bypasses RLS): fixtures and assertions. */
    sql: async <T extends Row = Row>(text: string, params: readonly unknown[] = []) => {
      try {
        return (await query(text, params)) as T[]
      } catch (error) {
        throw toDbError(error)
      }
    },
    as(actor: Actor) {
      return {
        sql: async <T extends Row = Row>(text: string, params: readonly unknown[] = []) =>
          (await run(actor, text, params)) as T[],
        /** Calls `public.<name>` with named arguments and returns its result. */
        rpc: async <T = unknown>(name: string, args: Record<string, unknown> = {}) => {
          const keys = Object.keys(args)
          const list = keys.map((key, index) => `${key} => $${index + 1}`).join(', ')
          const values = keys.map((key) => {
            const value = args[key]
            // jsonb arguments: objects and arrays of objects travel as JSON text.
            const isJson =
              typeof value === 'object' &&
              value !== null &&
              (!Array.isArray(value) || value.some((item) => typeof item === 'object'))
            return isJson ? JSON.stringify(value) : value
          })
          const [row] = await run(actor, `select public.${name}(${list}) as result`, values)
          return row?.['result'] as T
        },
      }
    },
    begin: () => query('begin').then(() => undefined),
    rollback: () => query('rollback').then(() => undefined),
    close,

    // --- fixtures ------------------------------------------------------------------------

    async createUser({ email, anonymous = false }: { email?: string; anonymous?: boolean } = {}) {
      const id = crypto.randomUUID()
      await query(
        `insert into auth.users (id, email, is_anonymous, created_at, updated_at)
         values ($1, $2, $3, now(), now())`,
        [id, email ?? null, anonymous],
      )
      return id
    },

    /** A Studio account; admins get aal2 unless told otherwise. */
    async createStaff({
      role = 'admin',
      aal = role === 'admin' ? 'aal2' : 'aal1',
      active = true,
      mustChangePassword = false,
      email,
    }: {
      role?: 'admin' | 'editor'
      aal?: 'aal1' | 'aal2'
      active?: boolean
      mustChangePassword?: boolean
      email?: string
    } = {}): Promise<Extract<Actor, { kind: 'user' }>> {
      const address = email ?? `${role}-${crypto.randomUUID().slice(0, 8)}@kasif.test`
      const id = await db.createUser({ email: address })
      await query(
        `insert into public.profiles (id, email, display_name, role, active, must_change_password)
         values ($1, $2, $3, $4, $5, $6)`,
        [id, address, `Test ${role}`, role, active, mustChangePassword],
      )
      return { kind: 'user', id, anonymous: false, aal }
    },

    /** An anonymous Kâşif device (signInAnonymously). */
    async createDevice(): Promise<Extract<Actor, { kind: 'user' }>> {
      const id = await db.createUser({ anonymous: true })
      return { kind: 'user', id, anonymous: true, aal: 'aal1' }
    },
  }
  return db
}

/** Registers the per-test transaction around every test of the file. */
export function setupTestDb() {
  let db: TestDb | undefined
  beforeAll(async () => {
    db = await createTestDb()
  }, 120_000)
  afterAll(async () => {
    await db?.close()
  })
  beforeEach(async () => {
    await db?.begin()
  })
  afterEach(async () => {
    await db?.rollback()
  })
  return () => {
    if (!db) throw new Error('Test database not ready')
    return db
  }
}

/** Awaits a rejected database call and returns its error (fails if it resolved). */
export async function dbError(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof DbError) return error
    throw error
  }
  throw new Error('Expected the database call to fail')
}

/** SQLSTATE of private.raise() for each AppError code. */
export const KS = {
  unauthorized: 'KS401',
  forbidden: 'KS403',
  not_found: 'KS404',
  conflict: 'KS409',
  validation: 'KS422',
  rate_limited: 'KS429',
  quota: 'KS430',
} as const
