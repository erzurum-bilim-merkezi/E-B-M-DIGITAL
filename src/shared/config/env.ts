import { parseEnv } from './env.schema'

/**
 * Single source of truth for client-side configuration.
 * Validated at build time (vite.config.ts) and again at startup, so a
 * misconfigured deployment fails fast instead of misbehaving at runtime.
 *
 * Keys are read one by one on purpose: passing `import.meta.env` as a whole makes Vite inline
 * *every* `VITE_*` variable into the bundle — including ones that should never be public.
 */
export const env = Object.freeze({
  ...parseEnv({
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_COMING_SOON: import.meta.env.VITE_COMING_SOON,
    VITE_PUBLIC_SITE_URL: import.meta.env.VITE_PUBLIC_SITE_URL,
    VITE_BACKEND: import.meta.env.VITE_BACKEND,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  /** `vite build --mode e2e`: test hooks (`window.__KASIF_E2E__`) are compiled in. */
  isE2E: import.meta.env.MODE === 'e2e',
  baseUrl: import.meta.env.BASE_URL,
})

export type Env = typeof env
