import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/shared/config/env'

/*
 * Supabase clients (ADR 0011, 0015). Two sessions that never mix:
 *   - staff: the Studio account, per browser tab (sessionStorage) — closing the tab signs out
 *   - kids:  the Kâşif app's anonymous device session, kept across visits (localStorage)
 * Both are created on first use, so mock builds never construct one.
 */

export const STAFF_AUTH_KEY = 'kasif:auth:staff'
export const KIDS_AUTH_KEY = 'kasif:auth:kid'

function config() {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).',
    )
  }
  return { url, key }
}

function create(storage: Storage, storageKey: string) {
  const { url, key } = config()
  return createClient(url, key, {
    auth: {
      storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      // No magic links or OAuth: nothing to pick up from the URL.
      detectSessionInUrl: false,
    },
  })
}

let staff: SupabaseClient | undefined
let kids: SupabaseClient | undefined

export function staffClient() {
  staff ??= create(window.sessionStorage, STAFF_AUTH_KEY)
  return staff
}

export function kidsClient() {
  kids ??= create(window.localStorage, KIDS_AUTH_KEY)
  return kids
}

/** Public URL of an object in a public bucket (media files, published snapshots). */
export function publicObjectUrl(bucket: 'media' | 'published', path: string) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${config().url}/storage/v1/object/public/${bucket}/${encoded}`
}

let deviceSession: Promise<string> | undefined

/**
 * The anonymous device session of the Kâşif app (signInAnonymously on first use), shared by
 * every kids adapter. Resolves to the device's auth user id.
 */
export function ensureDeviceSession(): Promise<string> {
  deviceSession ??= (async () => {
    const client = kidsClient()
    const { data } = await client.auth.getSession()
    if (data.session) return data.session.user.id
    const { data: created, error } = await client.auth.signInAnonymously()
    if (error || !created.user) throw error ?? new Error('Anonymous sign-in returned no user')
    return created.user.id
  })().catch((error: unknown) => {
    // Let the next call try again (offline start, rate limit).
    deviceSession = undefined
    throw error
  })
  return deviceSession
}

/** The device session if one exists, without creating it. */
export async function currentDeviceId() {
  const { data } = await kidsClient().auth.getSession()
  return data.session?.user.id ?? null
}

/** Test-only: forget cached clients (a test may change the session storage). */
export function resetSupabaseClients() {
  staff = undefined
  kids = undefined
  deviceSession = undefined
}
