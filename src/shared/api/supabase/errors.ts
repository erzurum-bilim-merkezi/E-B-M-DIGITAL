import { AppError, type AppErrorCode } from '@/shared/api/errors'

/*
 * Every Supabase failure becomes the AppError the ports promise (ADR 0015), so the UI does not
 * know which backend it talks to. RPCs raise SQLSTATE KSxxx with a Turkish message and a JSON
 * detail (supabase/migrations: private.raise), or return an error value when a failure counter
 * must survive the call (private.error).
 */

const SQLSTATE: Record<string, AppErrorCode> = {
  KS401: 'unauthorized',
  KS403: 'forbidden',
  KS404: 'not_found',
  KS409: 'conflict',
  KS422: 'validation',
  KS429: 'rate_limited',
  KS430: 'quota',
  // Postgres and PostgREST codes that reach us without a KS wrapper.
  '42501': 'forbidden',
  '23505': 'conflict',
  '23503': 'conflict',
  '23514': 'validation',
  '22P02': 'validation',
  '57014': 'unavailable',
  PGRST116: 'not_found',
  PGRST301: 'unauthorized',
  PGRST302: 'unauthorized',
  PGRST303: 'unauthorized',
}

const APP_CODES: ReadonlySet<string> = new Set<AppErrorCode>([
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'quota',
  'unavailable',
  'network',
  'storage_full',
])

function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && APP_CODES.has(value)
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {}
}

function parseDetails(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.startsWith('{')) return record(value)
  try {
    return record(JSON.parse(value))
  } catch {
    return {}
  }
}

function field(error: object, key: string): unknown {
  return key in error ? Reflect.get(error, key) : undefined
}

/** A network failure of fetch (offline, DNS, CORS) — retried by the query client. */
function isNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (typeof error === 'object' &&
      error !== null &&
      /fetch|network|Failed to fetch|NetworkError/i.test(String(field(error, 'message') ?? '')))
  )
}

/** Maps a PostgrestError, AuthError, StorageError, FunctionsError or network failure. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (typeof error !== 'object' || error === null) return new AppError('unavailable')

  const code = field(error, 'code')
  const message = field(error, 'message')
  const status = Number(field(error, 'status') ?? field(error, 'statusCode') ?? 0)

  if (typeof code === 'string' && code in SQLSTATE) {
    const mapped = SQLSTATE[code] ?? 'unavailable'
    // KS errors carry the user-facing Turkish message; others get the default for their code.
    const text = code.startsWith('KS') && typeof message === 'string' ? message : undefined
    return new AppError(mapped, text, parseDetails(field(error, 'details')))
  }

  // Auth (GoTrue) errors.
  if (field(error, '__isAuthError') === true || field(error, 'name') === 'AuthApiError') {
    if (code === 'invalid_credentials' || status === 400) {
      return new AppError('unauthorized', 'E-posta ya da parola hatalı.')
    }
    if (code === 'weak_password' || status === 422) {
      return new AppError('validation', 'Parola yeterince güçlü değil.')
    }
    if (status === 429 || code === 'over_request_rate_limit') return new AppError('rate_limited')
    if (status === 401 || status === 403) return new AppError('unauthorized')
  }

  if (status === 401) return new AppError('unauthorized')
  if (status === 403) return new AppError('forbidden')
  if (status === 404) return new AppError('not_found')
  if (status === 409) return new AppError('conflict')
  if (status === 429) return new AppError('rate_limited')
  if (isNetworkError(error)) return new AppError('network')
  return new AppError('unavailable')
}

/** `{ data, error }` of supabase-js → data, or the mapped AppError. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toAppError(result.error)
  return result.data
}

/**
 * Result of an RPC that returns its failures as values (`{ ok: false, error: { code, message,
 * details } }`) so that a failure counter is committed: throws them as AppError.
 */
export function unwrapResult(value: unknown): Record<string, unknown> {
  const result = record(value)
  if (result['ok'] === false) {
    const error = record(result['error'])
    const code = isAppErrorCode(error['code']) ? error['code'] : 'unavailable'
    const message = typeof error['message'] === 'string' ? error['message'] : undefined
    throw new AppError(code, message, record(error['details']))
  }
  return result
}
