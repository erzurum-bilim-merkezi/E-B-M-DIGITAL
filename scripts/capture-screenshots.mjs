#!/usr/bin/env node
// Captures the screenshots used by the Kâşif report and user guide (docs/rapor/).
// Needs the E2E build served like GitHub Pages:
//   node scripts/build-pages.mjs --mode e2e --outDir dist-e2e   (BASE_PATH=/E-B-M-DIGITAL/)
//   node scripts/pages-server.mjs dist-e2e
//   node scripts/capture-screenshots.mjs [outDir=docs/rapor/img]
// Uses only the local mock backend (demo seed) — never a live service.
/* oxlint-disable no-await-in-loop -- browser automation runs one step after another by design */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { chromium, devices } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/E-B-M-DIGITAL/'
const OUT = path.resolve(process.argv[2] ?? 'docs/rapor/img')
mkdirSync(OUT, { recursive: true })

const DEMO_SEED = {
  staff: true,
  kits: [
    { sample: 'kucuk-ciftciler', publish: true },
    { sample: 'blok-vitrini', publish: true },
    { sample: 'story-review' },
    { sample: 'quiz-draft' },
  ],
  activity: 'demo',
}
const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001'

const browser = await chromium.launch()
const shots = []

async function newContext(options, { staff = false, seedId = `shots-${Date.now()}` } = {}) {
  const context = await browser.newContext({
    baseURL: BASE,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    ...options,
  })
  await context.addInitScript(
    ({ seed, id, signedIn, adminId }) => {
      localStorage.setItem('kasif:mock:ai-delay', '0')
      Object.assign(window, { __KASIF_E2E_SEED__: { id, spec: seed } })
      if (signedIn && !sessionStorage.getItem('kasif:shots')) {
        sessionStorage.setItem('kasif:shots', '1')
        sessionStorage.setItem(
          'kasif:auth:staff',
          JSON.stringify({
            userId: adminId,
            aal: 'aal2',
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            pendingTotpSecret: null,
          }),
        )
      }
    },
    { seed: DEMO_SEED, id: seedId, signedIn: staff, adminId: ADMIN_ID },
  )
  return context
}

async function shot(page, name, { fullPage = false, locator } = {}) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350) // let entrance transitions settle for a still image
  const file = path.join(OUT, `${name}.jpg`)
  const target = locator ?? page
  await target.screenshot({
    path: file,
    type: 'jpeg',
    quality: 82,
    ...(locator ? {} : { fullPage }),
  })
  shots.push(name)
  console.log('✔', name)
}

// ── Kâşif on a phone ────────────────────────────────────────────────────────────────────────
{
  const context = await newContext({ ...devices['Pixel 7'] }, { seedId: 'shots-kids' })
  const page = await context.newPage()
  await page.goto('')
  await page.getByRole('heading', { name: 'Kâşif’e hoş geldin' }).waitFor()
  await shot(page, 'kids-01-hosgeldin')
  await page.getByLabel('Adın').fill('Deniz')
  await page.getByRole('button', { name: /Devam/ }).click()
  await page.getByRole('heading', { name: 'Avatarını seç' }).waitFor()
  await page.locator('label').filter({ hasText: 'Turkuaz Kâşif' }).click()
  await shot(page, 'kids-02-avatar')
  await page.getByRole('button', { name: /Bilim Merkezine Gir/ }).click()
  await page.getByTestId('restore-code').waitFor()
  await shot(page, 'kids-03-kasif-kodu')
  await page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()
  await page.getByRole('heading', { name: 'Merhaba Deniz!' }).waitFor()
  await shot(page, 'kids-04-bilim-merkezi')
  await page.goto('kit/kucuk-ciftciler')
  await page.getByRole('heading', { level: 1, name: 'Küçük Çiftçiler' }).waitFor()
  await shot(page, 'kids-05-kit', { fullPage: true })
  await page.goto('?q=KC-01')
  await page.getByRole('heading', { level: 1, name: /Tohum nedir/ }).waitFor()
  await shot(page, 'kids-06-kart-qr')
  await page.getByRole('button', { name: 'Tohuma dokun!' }).click()
  await page.getByText(/Filiz çıktı!/).waitFor()
  await shot(page, 'kids-07-kart-cevap', { fullPage: true })
  await page.goto('kit/kucuk-ciftciler/marul-nasil-yetisir')
  await page.getByRole('slider', { name: 'Büyüme aşaması' }).waitFor()
  await shot(page, 'kids-08-evre-kaydirici')
  await page.goto('kit/kucuk-ciftciler/sera-nedir')
  await page.getByRole('button', { name: 'Işık', exact: true }).click()
  await shot(page, 'kids-09-kesif-butonlari')
  await page.goto('kit/kucuk-ciftciler/tohum-cimlenmek-icin-ne-ister')
  await page.getByRole('button', { name: 'Su', exact: true }).click()
  await shot(page, 'kids-10-dogrulari-sec')
  await page.goto('qr-okut')
  await page.getByRole('heading', { level: 1, name: /QR Okut/ }).waitFor()
  await shot(page, 'kids-11-qr-okut')
  await page.goto('rozetlerim')
  await page.getByRole('heading', { level: 1, name: /Rozetlerim/ }).waitFor()
  await shot(page, 'kids-12-rozetler', { fullPage: true })
  await page.goto('profil')
  await page.getByRole('heading', { level: 1, name: 'Profilim' }).waitFor()
  await shot(page, 'kids-13-profil', { fullPage: true })
  await page.goto('kit/kucuk-ciftciler/tamamlandi')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await shot(page, 'kids-14-tamamlandi')
  await page.goto('giris')
  await page.getByRole('heading', { level: 1, name: 'Kâşif kodum var' }).waitFor()
  await shot(page, 'kids-15-kod-ile-giris')
  await context.close()
}

// ── Kâşif on a tablet (Blok Vitrini: all 13 card types) ─────────────────────────────────────
{
  const context = await newContext(
    {
      viewport: { width: 820, height: 1180 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    },
    { seedId: 'shots-tablet' },
  )
  const page = await context.newPage()
  await page.goto('hosgeldin')
  await page.getByLabel('Adın').fill('Ela')
  await page.getByRole('button', { name: /Devam/ }).click()
  await page.getByRole('button', { name: /Bilim Merkezine Gir/ }).click()
  await page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()
  await page.goto('kit/blok-vitrini')
  await page.getByRole('heading', { level: 1, name: 'Blok Vitrini' }).waitFor()
  await shot(page, 'tablet-01-blok-vitrini')
  const cards = await page
    .getByRole('link')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href') ?? '')
        .filter(
          (href) => /\/kit\/blok-vitrini\/[^/]+$/.test(href) && !href.endsWith('/tamamlandi'),
        ),
    )
  for (const [index, href] of cards.entries()) {
    await page.goto(href.replace(/^\/E-B-M-DIGITAL\//, ''))
    await page.getByRole('heading', { level: 1 }).waitFor()
    await shot(page, `tablet-blok-${String(index + 1).padStart(2, '0')}`)
  }
  await context.close()
}

// ── Kâşif Studio (desktop, admin) ───────────────────────────────────────────────────────────
for (const colorScheme of ['light', 'dark']) {
  const context = await newContext(
    { viewport: { width: 1440, height: 900 }, colorScheme },
    { staff: true, seedId: `shots-studio-${colorScheme}` },
  )
  const page = await context.newPage()
  const suffix = colorScheme === 'dark' ? '-koyu' : ''
  await page.goto('studio')
  await page.getByRole('heading', { level: 1, name: /Merhaba/ }).waitFor()
  await shot(page, `studio-01-pano${suffix}`)
  if (colorScheme === 'dark') {
    await page.goto('studio/analitik')
    await page.getByRole('heading', { level: 1, name: 'Analitik' }).waitFor()
    await shot(page, `studio-analitik${suffix}`)
    await context.close()
    continue
  }
  await page.goto('studio/kitler')
  await page.getByRole('heading', { level: 1, name: 'Kâşif Kitleri' }).waitFor()
  await shot(page, 'studio-02-kitler')
  const kit = (
    (await page.getByRole('link', { name: 'Küçük Çiftçiler' }).getAttribute('href')) ?? ''
  ).replace(/^\/E-B-M-DIGITAL\//, '')
  await page.goto('studio/kitler/yeni')
  await page.getByRole('heading', { level: 1, name: 'Yeni Kâşif Kiti' }).waitFor()
  await shot(page, 'studio-03-sihirbaz')
  for (const [tab, name] of [
    ['genel', '04-editor-genel'],
    ['kartlar', '05-editor-kartlar'],
    ['tema', '06-editor-tema'],
    ['rozet', '07-editor-rozet'],
    ['yayin', '08-editor-yayin'],
  ]) {
    await page.goto(`${kit}?sekme=${tab}`)
    await page.getByRole('heading', { level: 1, name: 'Küçük Çiftçiler' }).waitFor()
    await shot(page, `studio-${name}`)
  }
  await page.goto(`${kit}/onizleme`)
  await page.getByRole('heading', { level: 1, name: /Önizleme/ }).waitFor()
  await shot(page, 'studio-09-onizleme')
  await page.goto(`${kit}/surumler`)
  await page.getByRole('heading', { level: 1, name: 'Sürümler' }).waitFor()
  await shot(page, 'studio-10-surumler')
  await page.goto(`${kit}/qr`)
  await page.getByRole('heading', { level: 1, name: 'QR kodları' }).waitFor()
  await shot(page, 'studio-11-qr')
  await page.goto(`${kit}/qr/yazdir`)
  await page.getByRole('heading', { level: 1, name: /QR yazdır/ }).waitFor()
  await shot(page, 'studio-12-qr-yazdir')
  await page.goto(`${kit}/analiz`)
  await page.getByRole('heading', { level: 1, name: 'Kit analizi' }).waitFor()
  await shot(page, 'studio-13-kit-analizi', { fullPage: true })
  await page.goto('studio/analitik')
  await page.getByRole('heading', { level: 1, name: 'Analitik' }).waitFor()
  await shot(page, 'studio-14-analitik', { fullPage: true })
  await page.goto('studio/kasifler')
  await page.getByRole('heading', { level: 1, name: 'Kâşifler' }).waitFor()
  await shot(page, 'studio-15-kasifler')
  const explorer = (
    (await page
      .getByRole('table', { name: 'Kâşifler' })
      .getByRole('link')
      .first()
      .getAttribute('href')) ?? ''
  ).replace(/^\/E-B-M-DIGITAL\//, '')
  await page.goto(explorer)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await shot(page, 'studio-16-kasif-detay')
  await page.goto('studio/medya')
  await page.getByRole('heading', { level: 1, name: 'Medya' }).waitFor()
  await shot(page, 'studio-17-medya')
  await page.goto('studio/kullanicilar')
  await page.getByRole('heading', { level: 1, name: 'Kullanıcılar' }).waitFor()
  await shot(page, 'studio-18-kullanicilar')
  await page.goto('studio/ayarlar')
  await page.getByRole('heading', { level: 1, name: 'Ayarlar' }).waitFor()
  await shot(page, 'studio-19-ayarlar', { fullPage: true })
  await context.close()
}

// ── Studio sign-in (signed out) ─────────────────────────────────────────────────────────────
{
  const context = await newContext(
    { viewport: { width: 1440, height: 900 } },
    { seedId: 'shots-login' },
  )
  const page = await context.newPage()
  await page.goto('studio/giris')
  await page.getByRole('heading', { level: 1, name: 'Studio’ya giriş' }).waitFor()
  await shot(page, 'studio-00-giris')
  await page.getByLabel('E-posta').fill('yonetici@kasif.dev')
  await page.getByRole('textbox', { name: 'Parola', exact: true }).fill('Kasif.Studio.2026')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await page.getByRole('heading', { level: 1, name: 'İki adımlı doğrulama' }).waitFor()
  await shot(page, 'studio-00-2fa')
  await context.close()
}

await browser.close()
console.log(`\n${shots.length} screenshots → ${OUT}`)
