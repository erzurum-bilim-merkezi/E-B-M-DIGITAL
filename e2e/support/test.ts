import { createHmac } from 'node:crypto'

import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test'

/*
 * Shared fixtures for the mock-backend E2E suite (docs/plan §4.2):
 *  • `seed` — declarative mock data, applied once per test (reloads keep the data);
 *  • `staff` — a signed-in Studio role injected into sessionStorage (UI login only in auth specs);
 *  • every page fails the test on `pageerror`, `console.error` and CSP violations.
 */

export type SeedKit = {
  sample: 'kucuk-ciftciler' | 'blok-vitrini' | 'quiz-draft' | 'story-review'
  publish?: boolean
  visibility?: 'public' | 'unlisted'
}

export type SeedSpec = {
  staff?: boolean
  kits?: SeedKit[]
  activity?: 'demo' | 'none'
  settings?: Record<string, unknown>
}

export const SEEDS = {
  /** Two published kits (Küçük Çiftçiler KC-01…07, Blok Vitrini BV-01…13) + two drafts. */
  standard: {
    staff: true,
    kits: [
      { sample: 'kucuk-ciftciler', publish: true },
      { sample: 'blok-vitrini', publish: true },
      { sample: 'story-review' },
      { sample: 'quiz-draft' },
    ],
    activity: 'none',
  },
  /** Standard + 24 demo explorers with a month of activity (dashboards, analytics). */
  demo: {
    staff: true,
    kits: [
      { sample: 'kucuk-ciftciler', publish: true },
      { sample: 'blok-vitrini', publish: true },
      { sample: 'story-review' },
      { sample: 'quiz-draft' },
    ],
    activity: 'demo',
  },
  /** Staff accounts only. */
  empty: { staff: true, kits: [], activity: 'none' },
} satisfies Record<string, SeedSpec>

export type StaffRole = 'admin' | 'admin2' | 'editor'

export const STAFF = {
  admin: {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'yonetici@kasif.dev',
    password: 'Kasif.Studio.2026',
    name: 'Deniz Yıldız',
  },
  admin2: {
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'ikinci.yonetici@kasif.dev',
    password: 'Kasif.Studio.2026',
    name: 'Ali Kaya',
  },
  editor: {
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'editor@kasif.dev',
    password: 'Kasif.Editor.2026',
    name: 'Elif Demir',
  },
} as const satisfies Record<
  StaffRole,
  { id: string; email: string; password: string; name: string }
>

export const DEMO_TOTP_SECRET = 'KASIFSTUDIODEMOTOTPSECRETKASIF23'

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — the admin demo accounts' second factor. */
export function totp(secret = DEMO_TOTP_SECRET, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.replace(/=+$/, '')) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? [])
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)))
  const hmac = createHmac('sha1', key).update(counter).digest()
  const offset = (hmac.at(-1) ?? 0) & 0x0f
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

/** Seeds the mock backend of a context (once per `id`) and makes the fake AI instant. */
export async function prepareContext(
  context: BrowserContext,
  { id, seed, staff }: { id: string; seed: SeedSpec | null; staff: StaffRole | null },
) {
  await context.addInitScript(
    ({ id, seed, staff, userId }) => {
      localStorage.setItem('kasif:mock:ai-delay', '0')
      if (seed) Object.assign(window, { __KASIF_E2E_SEED__: { id, spec: seed } })
      // Inject the staff session once per tab, so signing out inside a test sticks.
      if (staff && userId && !sessionStorage.getItem('kasif:e2e:session-injected')) {
        sessionStorage.setItem('kasif:e2e:session-injected', '1')
        sessionStorage.setItem(
          'kasif:auth:staff',
          JSON.stringify({
            userId,
            aal: 'aal2',
            expiresAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
            pendingTotpSecret: null,
          }),
        )
      }
    },
    { id, seed, staff, userId: staff ? STAFF[staff].id : null },
  )
}

const IGNORED_CONSOLE = [
  // Deep links are answered by 404.html with status 404 (GitHub Pages SPA fallback).
  /Failed to load resource: the server responded with a status of 404/,
]

/** Collects uncaught errors, console errors and CSP violations of a page. */
export function watchPageErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) {
      // …but only for documents (routes), never for assets.
      const url = message.location().url
      if (!/\.(?:js|css|png|svg|webp|jpg|woff2?|json|webmanifest)(?:\?|$)/.test(url)) return
    }
    errors.push(`console.error: ${text}`)
  })
}

type Fixtures = {
  /** Mock data for this test (null = empty backend, e.g. a context that imports state). */
  seed: SeedSpec | null
  /** Signed-in Studio role for this test's context (null = signed out). */
  staff: StaffRole | null
  pageErrors: string[]
}

export const test = base.extend<Fixtures>({
  seed: [SEEDS.standard, { option: true }],
  staff: [null, { option: true }],
  pageErrors: async ({}, use) => {
    await use([])
  },
  context: async ({ context, seed, staff }, use, testInfo) => {
    await prepareContext(context, {
      id: `${testInfo.testId}-${testInfo.retry}-${testInfo.repeatEachIndex}`,
      seed,
      staff,
    })
    await use(context)
  },
  page: async ({ page, pageErrors }, use) => {
    watchPageErrors(page, pageErrors)
    await use(page)
    expect(pageErrors, 'page errors, console errors or CSP violations').toEqual([])
  },
})

export { expect }

/** Kâşif (kids): joins with a nickname on /hosgeldin and returns the restore code shown. */
export async function joinAsExplorer(page: Page, nickname = 'Deniz', avatarLabel?: string) {
  await expect(page.getByRole('heading', { name: 'Kâşif’e hoş geldin' })).toBeVisible()
  await page.getByLabel('Adın').fill(nickname)
  await page.getByRole('button', { name: /Devam/ }).click()
  await expect(page.getByRole('heading', { name: 'Avatarını seç' })).toBeVisible()
  if (avatarLabel) {
    // The radio is visually hidden behind its picture (peer pattern): tap the picture's label.
    await page.locator('label').filter({ hasText: avatarLabel }).click()
    await expect(page.getByRole('radio', { name: avatarLabel })).toBeChecked()
  }
  await page.getByRole('button', { name: /Bilim Merkezine Gir/ }).click()
}

/** Kâşif: completes the welcome flow from the home page and lands in the Science Center. */
export async function joinFromHome(page: Page, nickname = 'Deniz') {
  await page.goto('')
  await joinAsExplorer(page, nickname)
  const code = (await page.getByTestId('restore-code').textContent())?.trim() ?? ''
  await page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Merhaba ${nickname}!` })).toBeVisible()
  return code
}

/** Moves the mock backend (localStorage tables + media) from one context to another. */
export async function transferState(from: Page, to: Page) {
  const dump = await from.evaluate(async () => {
    const hooks = (window as unknown as { __KASIF_E2E__: { exportState(): Promise<unknown> } })
      .__KASIF_E2E__
    return hooks.exportState()
  })
  await to.evaluate(async (state) => {
    const hooks = (
      window as unknown as { __KASIF_E2E__: { importState(state: unknown): Promise<void> } }
    ).__KASIF_E2E__
    await hooks.importState(state)
  }, dump)
}

/**
 * A second device (own browser context: own localStorage, device id and session) with the
 * project's options. Its mock backend starts empty — fill it with `transferState`.
 */
export async function openDevice(
  browser: Browser,
  testInfo: TestInfo,
  errors: string[],
  options: BrowserContextOptions = {},
) {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    serviceWorkers: 'block',
    ...options,
  })
  await prepareContext(context, { id: `${testInfo.testId}-device`, seed: null, staff: null })
  const page = await context.newPage()
  watchPageErrors(page, errors)
  return { context, page }
}

/** Waits until the Kâşif offline event queue has been delivered to the (mock) server. */
export async function waitForEventsSent(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('kasif:activity-queue:v1')
        const queue: unknown = raw ? JSON.parse(raw) : []
        return Array.isArray(queue) ? queue.length : 0
      }),
    )
    .toBe(0)
}
