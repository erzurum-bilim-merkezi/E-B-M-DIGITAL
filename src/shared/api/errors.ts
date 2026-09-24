export type AppErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'quota'
  | 'unavailable'
  | 'network'
  | 'storage_full'

const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  unauthorized: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  forbidden: 'Bu işlem için yetkiniz yok.',
  not_found: 'Aradığınız kayıt bulunamadı.',
  conflict: 'Kayıt başka bir yerde değişti.',
  validation: 'Bilgiler eksik ya da hatalı.',
  rate_limited: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
  quota: 'Günlük kullanım sınırına ulaşıldı.',
  unavailable: 'Hizmet şu anda yanıt vermiyor. Biraz sonra tekrar deneyin.',
  network: 'İnternet bağlantısı yok gibi görünüyor.',
  storage_full: 'Cihazdaki depolama alanı doldu.',
}

/** Errors that retrying cannot fix (the query client skips retries for these). */
const PERMANENT: ReadonlySet<AppErrorCode> = new Set([
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'quota',
  'storage_full',
])

/**
 * Error every data port throws, whatever the adapter (mock or Supabase). UI code switches on
 * `code`; `message` is already user-facing Turkish.
 */
export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details: Readonly<Record<string, unknown>>

  constructor(code: AppErrorCode, message?: string, details: Record<string, unknown> = {}) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  get isPermanent() {
    return PERMANENT.has(this.code)
  }
}

export function isAppError(error: unknown, code?: AppErrorCode): error is AppError {
  return error instanceof AppError && (code === undefined || error.code === code)
}

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown) {
  if (error instanceof AppError) return error.message
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return DEFAULT_MESSAGES.network
  }
  return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
}
