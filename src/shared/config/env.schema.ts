import { z } from 'zod'

/**
 * `true` for keys that must never reach a browser: new-style secret keys and legacy JWT keys of
 * the `service_role` (both bypass row level security).
 */
export function isSecretSupabaseKey(key: string) {
  if (key.startsWith('sb_secret_')) return true
  const [, payload] = key.split('.')
  if (!payload) return false
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return (
      typeof json === 'object' && json !== null && 'role' in json && json.role === 'service_role'
    )
  } catch {
    return false
  }
}

// Pure module (no `import.meta.env`, no path aliases) so vite.config.ts can
// validate the same schema at build time.
const envShape = z.object({
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
  /**
   * Data adapters (ADR 0015): the in-browser `mock` backend for development, tests and demos, or
   * the `supabase` project. The public site only launches on Supabase.
   */
  VITE_BACKEND: z.enum(['mock', 'supabase']).default('mock'),
  /** Supabase project URL, e.g. `https://abcd.supabase.co` (local stack: `http://127.0.0.1:54321`). */
  VITE_SUPABASE_URL: z
    .url({ protocol: /^https?$/ })
    .transform((url) => url.replace(/\/+$/, ''))
    .optional(),
  /**
   * The publishable (or legacy anon) key. Public by design — row level security protects the
   * data — but a secret or service-role key here would bypass it, so those fail the build.
   */
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .refine((key) => !isSecretSupabaseKey(key), {
      message: 'Secret/service_role keys must never ship to the browser (use the publishable key)',
    })
    .optional(),
})

export const envSchema = envShape.superRefine((value, ctx) => {
  if (value.VITE_BACKEND === 'supabase') {
    for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required when VITE_BACKEND=supabase',
        })
      }
    }
  }
  // The in-browser mock (demo accounts, data per device) must never be the public app.
  if (
    value.VITE_APP_ENV === 'production' &&
    !value.VITE_COMING_SOON &&
    value.VITE_BACKEND === 'mock'
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['VITE_BACKEND'],
      message: 'A production launch (VITE_COMING_SOON=false) needs VITE_BACKEND=supabase',
    })
  }
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
