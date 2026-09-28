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

// One journey on one stack, never reset between attempts: a retry would meet the first attempt's
// kit and member (a second "Supabase Bahçesi", a second "Kaan") and hide the real failure.
test.describe.configure({ retries: 0 })

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

  // The kit list searches with Turkish letter case through PostgREST (kit_search): "BAHÇESİ"
  // (capital İ) finds the title "Supabase Bahçesi", which plain ilike cannot; the address
  // (supabase-bahcesi) is ASCII and matches as typed, as in the mock.
  await studio.page.goto('studio/kitler?q=BAH%C3%87ES%C4%B0')
  await expect(studio.page.getByRole('link', { name: /Supabase Bahçesi/ }).first()).toBeVisible()
  await studio.page.goto('studio/kitler?q=bah%C3%A7em')
  // Loaded and empty (not merely still loading); a failed query would say "yüklenemedi".
  await expect(studio.page.getByText('Eşleşen kit yok')).toBeVisible()
  await studio.page.goto('studio/kitler?q=Supabase')
  await studio.page
    .getByRole('link', { name: /Supabase Bahçesi/ })
    .first()
    .click()
  await expect(
    studio.page.getByRole('heading', { level: 1, name: 'Supabase Bahçesi' }),
  ).toBeVisible()

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

  // 6 · An admin adds a Studio user: the admin-users Edge Function (caller JWT, project keys,
  // CORS, Supabase Auth admin API, staff_register) end to end.
  await studio.page.goto('studio/kullanicilar')
  await expect(studio.page.getByRole('table', { name: 'Studio kullanıcıları' })).toBeVisible()
  await studio.page.getByRole('button', { name: 'Kullanıcı ekle' }).click()
  const form = studio.page.getByRole('dialog', { name: 'Kullanıcı ekle' })
  await form.getByRole('textbox', { name: 'Ad soyad' }).fill('Yeni Editör')
  await form.getByRole('textbox', { name: 'E-posta' }).fill('yeni.editor@kasif.test')
  await form.getByRole('button', { name: 'Kullanıcıyı oluştur' }).click()
  const temporary = studio.page.getByRole('dialog', { name: 'Geçici parola' })
  await expect(temporary).toBeVisible({ timeout: 20_000 })
  await temporary.getByRole('button', { name: 'Kaydettim, kapat' }).click()
  await expect(studio.page.getByText('yeni.editor@kasif.test')).toBeVisible()

  await Promise.all([studio.context.close(), phone.context.close(), tablet.context.close()])
})
