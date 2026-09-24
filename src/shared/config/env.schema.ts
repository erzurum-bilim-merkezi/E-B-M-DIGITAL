import { z } from 'zod'

// Pure module (no `import.meta.env`, no path aliases) so vite.config.ts can
// validate the same schema at build time.
export const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('Erzurum Bilim Merkezi'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_API_BASE_URL: z.url().default('http://localhost:3000/api'),
  /** Public "work in progress" mode: every route renders the coming-soon page. */
  VITE_COMING_SOON: z.stringbool().default(false),
})

export function parseEnv(source: Record<string, unknown>) {
  // CI systems often pass unset variables as empty strings — treat those as "not set".
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = envSchema.safeParse(defined)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
