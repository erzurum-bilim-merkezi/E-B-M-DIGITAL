import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env['CI']

const APP_PORT = 4173
const COMING_SOON_PORT = 4174

// Pass the full environment explicitly so each web server gets its own overrides on top.
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /coming-soon/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${APP_PORT}` },
    },
    {
      name: 'mobile',
      testIgnore: /coming-soon/,
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${APP_PORT}` },
    },
    {
      name: 'coming-soon',
      testMatch: /coming-soon\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${COMING_SOON_PORT}` },
    },
    {
      name: 'coming-soon-mobile',
      testMatch: /coming-soon\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${COMING_SOON_PORT}` },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview',
      port: APP_PORT,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
    {
      // Same code, built the way the public site is: coming-soon mode on.
      command: `npx vite build --outDir dist-coming-soon && npx vite preview --outDir dist-coming-soon --port ${COMING_SOON_PORT} --strictPort`,
      port: COMING_SOON_PORT,
      env: { ...inheritedEnv, VITE_COMING_SOON: 'true' },
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
})
