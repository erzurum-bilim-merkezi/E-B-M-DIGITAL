import { http, HttpResponse } from 'msw'

import { KIDS_AUTH_KEY, resetSupabaseClients, STAFF_AUTH_KEY } from '@/shared/api/supabase'

import { server } from './mocks/server'

/*
 * MSW helpers for unit tests of the *.supabase.ts adapters. supabase-js talks HTTP (PostgREST,
 * GoTrue, Storage), so the adapters are tested end to end in jsdom against these handlers; the
 * same adapters run against a real local Supabase stack in CI (contract tests).
 */

export const SUPABASE_URL = 'http://127.0.0.1:54321'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type RpcResolver = (args: Record<string, unknown>) => unknown

function jsonBody(value: unknown) {
  return HttpResponse.json(JSON.parse(JSON.stringify(value ?? null)) as Json)
}

/** Answers `rpc(name)`; the resolver gets the arguments and returns the result. */
export function rpc(name: string, resolver: RpcResolver) {
  const calls: Record<string, unknown>[] = []
  server.use(
    http.post(`${SUPABASE_URL}/rest/v1/rpc/${name}`, async ({ request }) => {
      const body: unknown = await request.json().catch(() => ({}))
      const args = typeof body === 'object' && body !== null ? { ...body } : {}
      calls.push(args)
      return jsonBody(resolver(args))
    }),
  )
  return calls
}

/** An RPC that raises private.raise(code, message, details). */
export function rpcError(name: string, code: string, message: string, details: object = {}) {
  server.use(
    http.post(`${SUPABASE_URL}/rest/v1/rpc/${name}`, () =>
      HttpResponse.json(
        { code, message, details: JSON.stringify(details), hint: null },
        { status: 400 },
      ),
    ),
  )
}

/** Answers `from(table).select(...)`; returns the query strings the adapter sent. */
export function table(name: string, rows: unknown[]) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get(`${SUPABASE_URL}/rest/v1/${name}`, ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      // .single() asks PostgREST for one object (406 + PGRST116 when there is none).
      if (request.headers.get('accept')?.includes('vnd.pgrst.object')) {
        return rows.length === 1
          ? jsonBody(rows[0])
          : HttpResponse.json(
              {
                code: 'PGRST116',
                message: 'JSON object requested, multiple (or no) rows returned',
              },
              { status: 406 },
            )
      }
      return jsonBody(rows)
    }),
  )
  return queries
}

/**
 * Answers `functions.invoke(name)` with the resolver's JSON (status 200); the resolver gets the
 * JSON body the adapter sent. Returns the bodies, in call order.
 */
export function edgeFunction(name: string, resolver: RpcResolver) {
  const bodies: Record<string, unknown>[] = []
  server.use(
    http.post(`${SUPABASE_URL}/functions/v1/${name}`, async ({ request }) => {
      const body: unknown = await request.json().catch(() => ({}))
      const args = typeof body === 'object' && body !== null ? { ...body } : {}
      bodies.push(args)
      return jsonBody(resolver(args))
    }),
  )
  return bodies
}

/** An Edge Function refusing with its JSON error (`errorResponse` of supabase/functions/_shared). */
export function edgeFunctionError(
  name: string,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  server.use(
    http.post(`${SUPABASE_URL}/functions/v1/${name}`, () =>
      HttpResponse.json(
        JSON.parse(
          JSON.stringify(details ? { code, message, details } : { code, message }),
        ) as Json,
        { status },
      ),
    ),
  )
}

/** A public file in a bucket (`status` 400 = missing object, like Storage answers). */
export function publicFile(bucket: string, path: string, body: unknown, status = 200) {
  server.use(
    http.get(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, () =>
      status === 200
        ? jsonBody(body)
        : HttpResponse.json({ statusCode: '404', error: 'not_found' }, { status }),
    ),
  )
}

function base64url(value: object) {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** An unsigned JWT with the given claims (supabase-js decodes but never verifies it). */
export function fakeJwt(claims: Record<string, unknown>) {
  const encode = base64url
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'authenticated',
    ...claims,
  })}.c2lnbmF0dXJl`
}

function storedSession(userId: string, claims: Record<string, unknown>) {
  return JSON.stringify({
    access_token: fakeJwt({ sub: userId, ...claims }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      is_anonymous: claims['is_anonymous'] === true,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  })
}

/** A Kâşif device that already signed in anonymously. */
export function signedInDevice(userId: string = crypto.randomUUID()) {
  resetSupabaseClients()
  localStorage.setItem(KIDS_AUTH_KEY, storedSession(userId, { is_anonymous: true, aal: 'aal1' }))
  return userId
}

/** A Studio session in this tab. */
export function signedInStaff(userId: string = crypto.randomUUID(), aal: 'aal1' | 'aal2' = 'aal2') {
  resetSupabaseClients()
  sessionStorage.setItem(STAFF_AUTH_KEY, storedSession(userId, { is_anonymous: false, aal }))
  return userId
}

/** Clears Supabase sessions and cached clients (use in afterEach). */
export function resetSupabase() {
  localStorage.removeItem(KIDS_AUTH_KEY)
  sessionStorage.removeItem(STAFF_AUTH_KEY)
  resetSupabaseClients()
}
