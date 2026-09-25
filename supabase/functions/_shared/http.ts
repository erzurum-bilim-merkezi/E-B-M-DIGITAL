// HTTP helpers shared by the Edge Functions (Deno). Plain TypeScript without imports, so the
// app's Vitest suite can test it too.

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

/**
 * CORS allows the live site only (`ALLOWED_ORIGIN`, comma-separated). Without it (the local
 * stack in CI) the Vite dev and preview servers on localhost are allowed.
 */
export function allowedOrigin(origin: string | null, configured: string | undefined) {
  if (!origin) return null
  const list = (configured ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  if (list.length > 0) return list.includes(origin) ? origin : null
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) ? origin : null
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' }
}

/** A failure with the SQLSTATE-style code the app maps to AppError (KS401 … KS430). */
export class HttpFailure extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const failures = {
  unauthorized: () =>
    new HttpFailure(401, 'KS401', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.'),
  forbidden: (message = 'Bu işlem için yetkiniz yok.') => new HttpFailure(403, 'KS403', message),
  notFound: (message = 'Kayıt bulunamadı.') => new HttpFailure(404, 'KS404', message),
  conflict: (message: string) => new HttpFailure(409, 'KS409', message),
  validation: (message = 'Bilgiler eksik ya da hatalı.') => new HttpFailure(422, 'KS422', message),
  rateLimited: (message = 'Çok fazla istek. Biraz bekleyip tekrar deneyin.') =>
    new HttpFailure(429, 'KS429', message),
  quota: (message = 'Günlük kullanım sınırına ulaşıldı.') => new HttpFailure(429, 'KS430', message),
  unavailable: (message = 'Hizmet şu anda yanıt vermiyor. Biraz sonra tekrar deneyin.') =>
    new HttpFailure(503, 'KS500', message),
}

export function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  })
}

/** Turns any thrown value into the JSON error answer; unexpected errors never leak details. */
export function errorResponse(error: unknown, origin: string | null) {
  if (error instanceof HttpFailure) {
    return json({ code: error.code, message: error.message }, error.status, origin)
  }
  console.error(error)
  const failure = failures.unavailable()
  return json({ code: failure.code, message: failure.message }, failure.status, origin)
}

/** An error from a database RPC (`{ code, message }` of PostgREST) passed on unchanged. */
export function fromRpcError(error: { code?: string; message?: string }) {
  const code = error.code ?? ''
  const status = code.startsWith('KS') ? Number(code.slice(2, 5)) || 400 : 400
  return new HttpFailure(
    status >= 400 && status < 600 ? status : 400,
    code.startsWith('KS') ? code : 'KS500',
    code.startsWith('KS') ? (error.message ?? '') : 'İşlem tamamlanamadı.',
  )
}
