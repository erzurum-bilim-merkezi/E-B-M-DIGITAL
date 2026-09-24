import { decodePngQr, pdfPageCount, readZip } from '../support/qr.ts'
import { expect, test } from '../support/test.ts'

const LIVE_SITE = 'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/'

test.describe('QR codes', () => {
  test.use({ staff: 'admin' })

  test.beforeEach(async ({ page }) => {
    await page.goto('studio/kitler')
    await page.getByRole('link', { name: 'Küçük Çiftçiler' }).click()
    await page.getByRole('link', { name: /QR/ }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'QR kodları' })).toBeVisible()
  })

  test('shows the kit code and one live code per card', async ({ page }) => {
    const active = page.getByRole('region', { name: 'Etkin kodlar' })
    await expect(active.getByRole('listitem')).toHaveCount(8)
    await expect(active.getByText('Yayında')).toHaveCount(8)
    await expect(page.getByText(`${LIVE_SITE}?q=KC`)).toBeVisible()
  })

  test('downloads every code as PNG in a ZIP; each PNG scans to the live site', async ({
    page,
  }) => {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Tümünü indir (ZIP)' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('kucuk-ciftciler-qr-kodlari.zip')
    const files = await readZip(await download.path())
    const pngs = files.filter((file) => file.name.endsWith('.png'))
    expect(pngs).toHaveLength(8)

    const card1 = pngs.find((file) => file.name.includes('kc-01'))
    expect(card1).toBeDefined()
    expect(decodePngQr(card1?.data ?? Buffer.alloc(0))).toBe(`${LIVE_SITE}?q=KC-01`)
  })

  test('prints business-card sheets on A4 and switches templates through the URL', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Yazdır' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /QR yazdır/ })).toBeVisible()
    await expect(page.getByRole('region', { name: /Sayfa 1 \/ 1/ })).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ preferCSSPageSize: true })
    expect(pdfPageCount(pdf)).toBe(1) // 8 codes fit on one 2 × 5 sheet
    await page.emulateMedia({ media: 'screen' })

    await page.getByRole('radio', { name: 'Ekipman etiketi' }).click()
    await expect(page).toHaveURL(/sablon=etiket/)
    await page.getByLabel('Etiket boyutu').selectOption('70')
    await expect(page).toHaveURL(/boyut=70/)
    // 70 mm stickers: 2 × 3 per page → 8 codes need 2 pages.
    await expect(page.getByRole('region', { name: /Sayfa 2 \/ 2/ })).toBeVisible()
  })
})
