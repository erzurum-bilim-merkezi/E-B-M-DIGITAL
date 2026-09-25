import { expect, joinAsExplorer, joinFromHome, test } from '../support/test.ts'

test.describe('QR entry', () => {
  test('a printed QR on a new device opens its card right after joining', async ({ page }) => {
    // Printed QRs encode the site root + ?q= (deep paths 404 on GitHub Pages).
    await page.goto('?q=KC-01')
    await expect(page).toHaveURL(/\/hosgeldin\?donus=/)

    await joinAsExplorer(page, 'Ada')

    // Joining from a QR skips the code screen: ≤ 3 taps from scan to card.
    await expect(page.getByRole('heading', { level: 1, name: /Tohum nedir\?/ })).toBeVisible()
    await expect(page).toHaveURL(/\/kit\/kucuk-ciftciler\/tohum-nedir\?giris=qr$/)
  })

  test('opens the card behind a code in focused mode', async ({ page }) => {
    await joinFromHome(page)
    await page.goto('?q=kc-3')

    await expect(page.getByRole('heading', { level: 1, name: /Sera nedir\?/ })).toBeVisible()
    // Focused entry (E-B-M style): no "next card", only the way to the kit's other cards.
    await expect(page.getByRole('link', { name: /Sıradaki kart/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Bu kitteki diğer kartlar/ })).toBeVisible()
  })

  test('the kit code opens the kit menu', async ({ page }) => {
    await joinFromHome(page)
    await page.goto('q/KC')

    await expect(page.getByRole('heading', { level: 1, name: 'Küçük Çiftçiler' })).toBeVisible()
  })

  test('explains unknown and malformed codes', async ({ page }) => {
    await joinFromHome(page)

    await page.goto('q/ZZ-09')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bu kart henüz etkin değil' }),
    ).toBeVisible()

    await page.goto('q/merhaba')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bu bir Kâşif kodu değil' }),
    ).toBeVisible()
  })

  test('a child can type the code printed under the QR', async ({ page }) => {
    await joinFromHome(page)
    await page.getByRole('link', { name: /QR Okut/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: /QR Okut/ })).toBeVisible()

    await page.getByLabel('Kodu yaz').fill('bv 1')
    await page.getByRole('button', { name: 'Aç', exact: true }).click()

    await expect(page).toHaveURL(/\/kit\/blok-vitrini\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
