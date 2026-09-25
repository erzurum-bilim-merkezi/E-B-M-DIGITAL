import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env['CI']

// Served like GitHub Pages: under the repository sub-path, no SPA rewrites, 404.html fallback.
const BASE_PATH = '/E-B-M-DIGITAL/'
const APP_PORT = 4173
const COMING_SOON_PORT = 4174
const SUPABASE_APP_PORT = 4175
const APP_URL = `http://localhost:${APP_PORT}${BASE_PATH}`
const COMING_SOON_URL = `http://localhost:${COMING_SOON_PORT}${BASE_PATH}`
const SUPABASE_APP_URL = `http://localhost:${SUPABASE_APP_PORT}${BASE_PATH}`

/**
 * E2E_SUPABASE=1 (CI, after `supabase start` and e2e/supabase/seed.ts): only the Supabase specs, on
 * a build that talks to the LOCAL stack (E2E_SUPABASE_URL / E2E_SUPABASE_KEY). The live project is
 * never a target: the URL must be local.
 */
const supabaseRun = process.env['E2E_SUPABASE'] === '1'
const supabaseUrl = process.env['E2E_SUPABASE_URL'] ?? 'http://127.0.0.1:54321'
if (supabaseRun && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error(`Supabase E2E runs against the local stack only (got ${supabaseUrl}).`)
}

// Pass the full environment explicitly so each web server gets its own overrides on top.
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
)

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const tablet = {
  ...devices['Desktop Chrome'],
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 2 } : {}),
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/e2e.json' }]]
    : [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/e2e.json' }]],
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Service workers stay out of the way except in dedicated PWA specs.
    serviceWorkers: 'block',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  },
  projects: supabaseRun
    ? [
        {
          name: 'supabase',
          testDir: './e2e/supabase',
          use: { ...desktop, baseURL: SUPABASE_APP_URL },
        },
      ]
    : [
        {
          name: 'kids-mobile',
          testDir: './e2e/kids',
          use: { ...devices['Pixel 7'], baseURL: APP_URL },
        },
        { name: 'kids-tablet', testDir: './e2e/kids', use: { ...tablet, baseURL: APP_URL } },
        {
          name: 'kids-desktop',
          testDir: './e2e/kids',
          use: { ...devices['Desktop Chrome'], baseURL: APP_URL },
        },
        { name: 'studio-desktop', testDir: './e2e/studio', use: { ...desktop, baseURL: APP_URL } },
        { name: 'journeys', testDir: './e2e/journeys', use: { ...desktop, baseURL: APP_URL } },
        { name: 'a11y', testDir: './e2e/a11y', use: { ...desktop, baseURL: APP_URL } },
        {
          name: 'coming-soon',
          testDir: './e2e/coming-soon',
          use: { ...devices['Desktop Chrome'], baseURL: COMING_SOON_URL },
        },
        {
          name: 'coming-soon-mobile',
          testDir: './e2e/coming-soon',
          use: { ...devices['Pixel 7'], baseURL: COMING_SOON_URL },
        },
      ],
  webServer: supabaseRun
    ? [
        {
          // The app on the Supabase adapters, pointed at the local stack.
          command:
            'node scripts/build-pages.mjs --outDir dist-supabase && node scripts/pages-server.mjs dist-supabase',
          url: SUPABASE_APP_URL,
          env: {
            ...inheritedEnv,
            BASE_PATH,
            PORT: String(SUPABASE_APP_PORT),
            VITE_COMING_SOON: 'false',
            VITE_BACKEND: 'supabase',
            VITE_SUPABASE_URL: supabaseUrl,
            VITE_SUPABASE_PUBLISHABLE_KEY: process.env['E2E_SUPABASE_KEY'] ?? '',
          },
          reuseExistingServer: !isCI,
          timeout: 300_000,
        },
      ]
    : [
        {
          // E2E build: mock backend with test hooks (window.__KASIF_E2E__), same CSP as production.
          command:
            'node scripts/build-pages.mjs --mode e2e --outDir dist-e2e && node scripts/pages-server.mjs dist-e2e',
          url: APP_URL,
          env: { ...inheritedEnv, BASE_PATH, PORT: String(APP_PORT), VITE_COMING_SOON: 'false' },
          reuseExistingServer: !isCI,
          timeout: 300_000,
        },
        {
          // Same code, built the way the public site is today: coming-soon mode on.
          command:
            'node scripts/build-pages.mjs --outDir dist-coming-soon && node scripts/pages-server.mjs dist-coming-soon',
          url: COMING_SOON_URL,
          env: {
            ...inheritedEnv,
            BASE_PATH,
            PORT: String(COMING_SOON_PORT),
            VITE_COMING_SOON: 'true',
          },
          reuseExistingServer: !isCI,
          timeout: 300_000,
        },
      ],
})
