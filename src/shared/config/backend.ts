import { env } from './env'

/**
 * Which data adapters the build uses (ADR 0015), from `VITE_BACKEND`. Development, tests and
 * demos run on the in-browser mock; the public site runs on Supabase (the build refuses a
 * production launch on the mock). Studio shows a "Deneme ortamı" banner on the mock.
 */
export const BACKEND_MODE = env.VITE_BACKEND

export const isMockBackend = BACKEND_MODE === 'mock'
export const isSupabaseBackend = BACKEND_MODE === 'supabase'
