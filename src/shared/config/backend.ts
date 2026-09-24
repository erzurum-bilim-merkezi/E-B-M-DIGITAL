/**
 * Which data adapters the build uses (ADR 0015). Only the mock backend exists until the Supabase
 * adapters land with F4 ("3 kez planla, 1 kez yap"); the live Supabase project is never used
 * by development or tests. Studio shows a "Deneme ortamı" banner while this is `mock`.
 */
export const BACKEND_MODE: 'mock' | 'supabase' = 'mock'

export const isMockBackend = BACKEND_MODE === 'mock'
