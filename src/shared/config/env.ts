import { parseEnv } from './env.schema'

/**
 * Single source of truth for client-side configuration.
 * Validated at build time (vite.config.ts) and again at startup, so a
 * misconfigured deployment fails fast instead of misbehaving at runtime.
 */
export const env = Object.freeze({
  ...parseEnv(import.meta.env),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
})

export type Env = typeof env
