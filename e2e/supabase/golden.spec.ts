import { devices, expect, test, type Browser, type Page } from '@playwright/test'

import { decodePngQr, readZip } from '../support/qr.ts'
import { joinFromHome, totp, waitForEventsSent } from '../support/test.ts'
import { SUPABASE_E2E } from './accounts.ts'

/*
 * The golden journey on the real backend (local Supabase stack in CI, ADR 0016 "Plan 3"): Studio
 * sign-in with TOTP, a kit published through the RPCs and Storage, a phone that scans the kit QR,
 * joins anonymously and plays, the activity back in the Studio, and the member restored on a
 * tablet with the Kâşif kodu. Nothing is injected — every step goes through the UI and Supabase.
 */

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }

async function newDevice(browser: Browser, baseURL: string, options = {}) {
  const context = await browser.newContext({
    baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    serviceWorkers: 'block',
    ...options,
  })
  return { context, page: await context.newPage() }
}

async function signInAsAdmin(page: Page) {
  const { email, password, totpSecret } = SUPABASE_E2E.admin
  await page.goto('studio/giris')
  await page.getByLabel('E-posta').fill(email)
  await page.getByRole('textbox', { name: 'Parola', exact: true }).fill(password)
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'İki adımlı doğrulama' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Doğrulama kodu' }).fill(totp(totpSecret))
  await page.getByRole('button', { name: 'Doğrula ve devam et' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Deniz' })).toBeVisible()
}

test('Supabase: Studio → publish → kit QR → phone → Studio sees it → restore on a tablet', async ({
  browser,
}, testInfo) => {
  test.setTimeout(5 * 60_000)
  const baseURL = String(testInfo.project.use.baseURL)

  // 1 · Studio: sign in with TOTP, create a kit from the sample template and publish it.
  const studio = await newDevice(browser, baseURL, desktop)
  await signInAsAdmin(studio.page)
  await studio.page.goto('studio/kitler/yeni')
  await studio.page.getByRole('radio', { name: /Örnek: Küçük Çiftçiler/ }).click()
  await studio.page.getByRole('button', { name: /Devam/ }).click()
  await studio.page.getByLabel('Kit adı').fill('Supabase Bahçesi')
  await studio.page.getByRole('button', { name: /Devam/ }).click()
  await studio.page.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()
  await expect(
    studio.page.getByRole('heading', { level: 1, name: 'Supabase Bahçesi' }),
  ).toBeVisible()
  await studio.page.getByRole('tab', { name: /Yayın/ }).click()
  await studio.page.getByRole('button', { name: 'Yayınla', exact: true }).click()
  await expect(studio.page.getByText('v1 yayınlandı')).toBeVisible({ timeout: 30_000 })

  // 2 · The kit's single QR (a new kit is "Bir QR yeter").
  await studio.page.getByRole('link', { name: /QR/ }).first().click()
  const download = studio.page.waitForEvent('download')
  await studio.page.getByRole('button', { name: 'Tümünü indir (ZIP)' }).click()
  const files = await readZip(await (await download).path())
  const png = files.find((file) => file.name.endsWith('.png'))
  const code = new URL(decodePngQr(png?.data ?? Buffer.alloc(0)) ?? '').searchParams.get('q') ?? ''
  expect(code).toMatch(/^[A-Z]{2,4}$/)

  // 3 · A phone joins (anonymous device session + membership; the Kâşif kodu is shown once),
  // scans the kit QR and plays the first card; the events reach the server.
  const phone = await newDevice(browser, baseURL, devices['Pixel 7'])
  const restoreCode = await joinFromHome(phone.page, 'Kaan')
  expect(restoreCode).toMatch(/KSF-/)
  await phone.page.goto(`?q=${code}`)
  await expect(phone.page.getByRole('heading', { level: 1, name: /Tohum nedir\?/ })).toBeVisible()
  await phone.page.getByRole('button', { name: 'Tohuma dokun!' }).click()
  await expect(phone.page.getByText(/Filiz çıktı!/)).toBeVisible()
  await waitForEventsSent(phone.page)

  // 4 · The Studio sees the member and the scan.
  await studio.page.goto('studio/kasifler')
  await expect(studio.page.getByRole('link', { name: /Kaan/ })).toBeVisible()

  // 5 · The Kâşif kodu brings the member and its progress to a tablet.
  const tablet = await newDevice(browser, baseURL, devices['iPad (gen 7)'])
  await tablet.page.goto('giris')
  await tablet.page.getByLabel('Kâşif kodun').fill(restoreCode)
  await tablet.page.getByRole('button', { name: /Giriş yap/ }).click()
  await expect(tablet.page.getByRole('heading', { level: 1, name: 'Merhaba Kaan!' })).toBeVisible()
  await tablet.page.getByRole('link', { name: /Supabase Bahçesi/ }).click()
  await expect(tablet.page.getByText(/1 \/ 7 kart tamamlandı/)).toBeVisible()

  await Promise.all([studio.context.close(), phone.context.close(), tablet.context.close()])
})
