import { z } from 'zod'

// Pure module (no `import.meta.env`, no path aliases) so vite.config.ts can
// validate the same schema at build time.
export const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('Erzurum Bilim Merkezi'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_API_BASE_URL: z.url().default('http://localhost:3000/api'),
  /** Public "work in progress" mode: every route renders the coming-soon page. */
  VITE_COMING_SOON: z.stringbool().default(false),
  /**
   * Live site root printed into every QR code (`<site>?q=KC-01`). Always the public address,
   * even when Studio runs locally, so printed labels keep working (ADR 0013).
   */
  VITE_PUBLIC_SITE_URL: z
    .url({ protocol: /^https?$/ })
    .default('https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/')
    .transform((url) => (url.endsWith('/') ? url : `${url}/`)),
})

/**
 * `VITE_*` values are inlined into the public bundle (anyone can read them on GitHub Pages).
 * Secrets such as `VITE_GEMINI_API_KEY` must live server-side (Edge Function secrets) — fail
 * the build instead of shipping them (ADR 0018).
 */
/** Words that mark a secret anywhere in a `VITE_*` name (split on "_"). */
const SECRET_WORDS = new Set([
  'KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PASSWD',
  'PASS',
  'PRIVATE',
  'CREDENTIAL',
  'CREDENTIALS',
  'PAT',
])
/** Keys that are public by design (the Supabase anon/publishable key ships to browsers). */
const PUBLIC_KEYS = new Set(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'])

export function isSecretLikeKey(key: string) {
  if (!key.startsWith('VITE_') || PUBLIC_KEYS.has(key)) return false
  const words = key.slice('VITE_'.length).split('_')
  return words.some((word) => SECRET_WORDS.has(word)) || key.includes('SERVICE_ROLE')
}

/** Names of defined `VITE_*` variables that look like secrets (checked by vite.config.ts). */
export function findSecretLikeKeys(source: Record<string, unknown>) {
  return Object.entries(source)
    .filter(([key, value]) => value !== '' && value !== undefined && isSecretLikeKey(key))
    .map(([key]) => key)
}

export function secretLeakMessage(keys: readonly string[]) {
  return (
    `Secrets must not be VITE_* variables (they ship to the browser): ${keys.join(', ')}. ` +
    'Keep API keys in server-side secrets (e.g. the GEMINI_API_KEY Edge Function secret).'
  )
}

export function parseEnv(source: Record<string, unknown>) {
  // CI systems often pass unset variables as empty strings — treat those as "not set".
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = envSchema.safeParse(defined)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
