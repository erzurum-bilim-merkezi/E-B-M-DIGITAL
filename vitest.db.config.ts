import { defineConfig } from 'vitest/config'

/**
 * Database tests (supabase/tests/db): migrations, RLS, grants and RPCs on PGlite locally, and on
 * the local Supabase stack in CI (TEST_DB_URL). Kept apart from the jsdom app tests.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['supabase/tests/db/**/*.test.ts'],
    // One database per file; files may run in parallel on PGlite, not on a shared CI database.
    fileParallelism: !process.env['TEST_DB_URL'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
