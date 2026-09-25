import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

/**
 * Database tests (supabase/tests/db): migrations, RLS, grants and RPCs on PGlite locally, and on
 * the local Supabase stack in CI (TEST_DB_URL). Kept apart from the jsdom app tests. The `@`
 * alias lets suites run the app's pure computations (e.g. analytics) against the SQL results.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Database suites and the plain-TypeScript helpers of the Edge Functions.
    include: ['supabase/tests/**/*.test.ts'],
    // One database per file; files may run in parallel on PGlite, not on a shared CI database.
    fileParallelism: !process.env['TEST_DB_URL'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
