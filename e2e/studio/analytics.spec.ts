import { readFile } from 'node:fs/promises'

import { expect, SEEDS, test } from '../support/test.ts'

test.describe('Dashboards and analytics (demo activity)', () => {
  test.use({ staff: 'admin', seed: SEEDS.demo })

  test('the dashboard summarises today, the trend, top cards and the live feed', async ({
    page,
  }) => {
    await page.goto('studio')

    await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Deniz' })).toBeVisible()
    await expect(page.getByText('Bugün aktif kâşif')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aktif kâşifler' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'En çok okutulan kartlar' })).toBeVisible()
    // Admins see who did what; each entry links to the explorer.
    await expect(page.getByRole('link', { name: /#[0-9A-Z]{4}/ }).first()).toBeVisible()
  })

  test('analytics keep the period in the URL and export CSV', async ({ page }) => {
    await page.goto('studio/analitik')
    await expect(page.getByRole('heading', { level: 1, name: 'Analitik' })).toBeVisible()

    await page.getByRole('radio', { name: '7 gün' }).click()
    await expect(page).toHaveURL(/aralik=7/)
    await expect(page.getByText('Tekil kâşif', { exact: true })).toBeVisible()
    // Every chart has a table twin (WCAG 1.1.1).
    await page.getByRole('button', { name: 'Tablo olarak göster' }).first().click()
    await expect(page.getByRole('table', { name: /Günlük tekil kâşif/ })).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV indir' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(
      /^kasif-etkinlik-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
    )
    const csv = await readFile(await download.path(), 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM: Excel opens Turkish characters correctly
    expect(csv.split('\n').length).toBeGreaterThan(2)
  })

  test('kit analytics show the card funnel', async ({ page }) => {
    await page.goto('studio/analitik?aralik=30')
    await page
      .getByRole('link', { name: /Küçük Çiftçiler/ })
      .first()
      .click()

    await expect(page.getByRole('heading', { level: 1, name: 'Kit analizi' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kart hunisi' })).toBeVisible()
    await expect(page.getByText('Kit açılışı', { exact: true })).toBeVisible()
  })

  test('an explorer’s data can be exported (JSON) and deleted (KVKK)', async ({ page }) => {
    await page.goto('studio/kasifler')
    await expect(page.getByRole('heading', { level: 1, name: 'Kâşifler' })).toBeVisible()
    const first = page.getByRole('table', { name: 'Kâşifler' }).getByRole('link').first()
    const nickname = (await first.textContent())?.split('#')[0]?.trim() ?? ''
    const href = (await first.getAttribute('href')) ?? ''
    await first.click()
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(nickname) })).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Verileri indir (JSON)' }).click()
    const download = await downloadPromise
    const json: unknown = JSON.parse(await readFile(await download.path(), 'utf8'))
    expect(json).toMatchObject({})

    await page.getByRole('button', { name: 'Kâşifi sil' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kalıcı olarak sil' }).click()
    await expect(page.getByText('Kâşif ve tüm verisi silindi')).toBeVisible()
    await expect(page).toHaveURL(/\/studio\/kasifler$/)
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0)
  })

  test('explorer filters live in the URL', async ({ page }) => {
    await page.goto('studio/kasifler')
    await page.getByLabel('Tamamlama').selectOption('evet')
    await expect(page).toHaveURL(/tamamladi=evet/)
    await page.getByLabel('Ara').fill('#zz')
    await expect(page).toHaveURL(/q=%23zz|q=#zz/)
    await expect(page.getByRole('heading', { name: 'Eşleşen kâşif yok' })).toBeVisible()
  })
})
