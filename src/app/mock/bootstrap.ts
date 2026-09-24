import { z } from 'zod'

import { injectStaffSession, DEMO_ACCOUNTS } from '@/features/auth'
import {
  exportMockDb,
  importMockDb,
  MOCK_DB_PREFIX,
  mockControl,
  resetMockDb,
  type MockDbDump,
} from '@/shared/api/mock-db'
import {
  exportMockMedia,
  importMockMedia,
  resetMockMedia,
  type MockMediaDump,
} from '@/shared/api/mock-media'
import type { AppErrorCode } from '@/shared/api/errors'
import { isMockBackend } from '@/shared/config/backend'
import { readStorage, removeStorage, storageKeys, writeStorage } from '@/shared/lib/storage'

import { applySeed, DEMO_SEED, seedSpecSchema, type SeedSpec } from './seed'

const SEED_MARKER = 'kasif:mock:seed-id'

/**
 * Compile-time switch: Vite replaces `import.meta.env.*` statically, so production bundles drop
 * the test hooks and the seed request entirely (checked by the deploy workflow's dist scan).
 */
const TEST_HOOKS = import.meta.env.DEV || import.meta.env.MODE === 'e2e'

const seedRequestSchema = z.object({ id: z.string().min(1), spec: seedSpecSchema })

type E2EHooks = {
  exportState(): Promise<{ db: MockDbDump; media: MockMediaDump }>
  importState(state: { db: MockDbDump; media: MockMediaDump }): Promise<void>
  reset(): Promise<void>
  seed(spec: SeedSpec): Promise<void>
  loginAs(role: 'admin' | 'admin2' | 'editor'): void
  failNext(operation: string, code: AppErrorCode, message?: string): void
  hold(operation: string): void
  release(operation: string): void
  setLatency(ms: number): void
}

declare global {
  interface Window {
    __KASIF_E2E__?: E2EHooks
    __KASIF_E2E_SEED__?: unknown
  }
}

/** Device-local keys (sessions, active member, queue) — not part of the shared "server" state. */
function clearDeviceState() {
  for (const key of storageKeys('kasif:')) {
    if (!key.startsWith(MOCK_DB_PREFIX) && key !== SEED_MARKER) removeStorage(key)
  }
  for (const key of storageKeys('kasif:', 'session')) removeStorage(key, 'session')
}

function installE2EHooks() {
  window.__KASIF_E2E__ = {
    async exportState() {
      return { db: exportMockDb(), media: await exportMockMedia() }
    },
    async importState(state) {
      importMockDb(state.db)
      await importMockMedia(state.media)
    },
    async reset() {
      resetMockDb()
      await resetMockMedia()
      clearDeviceState()
    },
    seed: applySeed,
    loginAs(role) {
      injectStaffSession(DEMO_ACCOUNTS[role].id)
    },
    failNext: mockControl.failNext,
    hold: mockControl.hold,
    release: mockControl.release,
    setLatency: mockControl.setLatency,
  }
}

/**
 * Prepares the mock backend before the first render:
 *  • E2E: applies `window.__KASIF_E2E_SEED__` once per seed id (reloads keep the data);
 *  • local demo: seeds demo content the first time this browser opens the app.
 * Test hooks exist in development and e2e builds only (see `TEST_HOOKS`).
 */
export async function bootstrapMockBackend() {
  if (!isMockBackend) return
  if (TEST_HOOKS) {
    installE2EHooks()
    const request = seedRequestSchema.safeParse(window.__KASIF_E2E_SEED__)
    if (request.success) {
      if (readStorage(SEED_MARKER) !== request.data.id) {
        resetMockDb()
        await resetMockMedia()
        await applySeed(request.data.spec)
        writeStorage(SEED_MARKER, request.data.id)
      }
      return
    }
    // E2E runs start empty unless a test seeds them.
    if (import.meta.env.MODE === 'e2e') return
  }
  if (storageKeys(MOCK_DB_PREFIX).length === 0) {
    await applySeed(DEMO_SEED)
    writeStorage(SEED_MARKER, 'demo')
  }
}

/** "Deneme verisini sıfırla" (Studio settings, mock only). */
export async function resetDemoData() {
  resetMockDb()
  await resetMockMedia()
  clearDeviceState()
  await applySeed(DEMO_SEED)
  writeStorage(SEED_MARKER, 'demo')
}
