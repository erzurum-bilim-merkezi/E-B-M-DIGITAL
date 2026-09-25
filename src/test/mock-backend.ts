import { applySeed, DEMO_SEED, type SeedSpec } from '@/app/mock/seed'
import { DEMO_ACCOUNTS, injectStaffSession } from '@/features/auth'
import { mockControl, resetMockDb } from '@/shared/api/mock-db'
import { resetMockMedia } from '@/shared/api/mock-media'
import { writeStorage } from '@/shared/lib/storage'

/**
 * Test helpers for the mock backend (localStorage tables + IndexedDB blobs via fake-indexeddb).
 * Every test that touches a mock service should start from a clean slate.
 */

/** Clears every mock table, stored blob, device key and test control; AI answers instantly. */
export async function resetMockBackend() {
  mockControl.reset()
  mockControl.setLatency(0)
  resetMockDb()
  await resetMockMedia()
  localStorage.clear()
  sessionStorage.clear()
  writeStorage('kasif:mock:ai-delay', '0')
}

/** A fresh backend seeded like the local demo (staff, 4 kits, demo activity) or with `spec`. */
export async function seedMockBackend(spec: SeedSpec = DEMO_SEED) {
  await resetMockBackend()
  await applySeed(spec)
}

/** Only the staff accounts and the two published sample kits — fast, no demo activity. */
export const MINIMAL_SEED: SeedSpec = {
  staff: true,
  kits: [
    { sample: 'kucuk-ciftciler', publish: true },
    { sample: 'blok-vitrini', publish: true },
  ],
  activity: 'none',
}

/** Signs a demo account in (admins with 2FA already verified). */
export function signInAs(role: keyof typeof DEMO_ACCOUNTS) {
  injectStaffSession(DEMO_ACCOUNTS[role].id)
}
