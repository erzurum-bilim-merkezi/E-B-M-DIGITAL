import type { Page } from '@playwright/test'

import { expect, joinFromHome, test } from '../support/test.ts'

async function nextCard(page: Page) {
  await page.getByRole('link', { name: /Sıradaki kart/ }).click()
}

async function expectCard(page: Page, title: RegExp) {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
}

test.describe('Playing a kit', () => {
  test('completes Küçük Çiftçiler card by card and earns the badge and certificate', async ({
    page,
  }) => {
    await joinFromHome(page, 'Mert')
    await page.getByRole('link', { name: /Küçük Çiftçiler/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Küçük Çiftçiler' })).toBeVisible()
    await expect(page.getByText('0 / 7 kart tamamlandı')).toBeVisible()

    await page.getByRole('link', { name: /Tohum nedir\?/ }).click()

    // 1 · tap-reveal
    await expectCard(page, /Tohum nedir\?/)
    await page.getByRole('button', { name: 'Tohuma dokun!' }).click()
    await expect(page.getByText(/Filiz çıktı!/)).toBeVisible()
    await nextCard(page)

    // 2 · stage slider — keyboard operable
    await expectCard(page, /Marul nasıl yetişir\?/)
    const slider = page.getByRole('slider', { name: 'Büyüme aşaması' })
    await slider.focus()
    await page.keyboard.press('End')
    await expect(slider).toHaveAttribute('aria-valuetext', /4\. aşama: Gelişen marul/)
    await nextCard(page)

    // 3 · explore hotspots
    await expectCard(page, /Sera nedir\?/)
    for (const name of ['Işık', 'Su', 'Sıcaklık', 'Hava']) {
      await page.getByRole('button', { name, exact: true }).click()
    }
    await expect(page.getByText('4 / 4 keşfedildi')).toBeAttached()
    await nextCard(page)

    // 4 · toggle scene
    await expectCard(page, /ışığa ihtiyaç/)
    await page.getByRole('button', { name: /Işığı Aç!/ }).click()
    await expect(page.getByRole('button', { name: /Işığı Kapat/ })).toBeVisible()
    await nextCard(page)

    // 5 · animated scene (completes on view)
    await expectCard(page, /suya ihtiyaç/)
    await nextCard(page)

    // 6 · choose the correct ones (a wrong tap only gives feedback)
    await expectCard(page, /çimlenmek için ne ister/)
    await page.getByRole('button', { name: 'Müzik', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: /müzik dinlemez/ })).toBeVisible()
    await page.getByRole('button', { name: 'Su', exact: true }).click()
    await page.getByRole('button', { name: 'Sıcaklık', exact: true }).click()
    await nextCard(page)

    // 7 · compare cards
    await expectCard(page, /Tohum ile fide/)
    await page.getByRole('button', { name: /Tohum/ }).first().click()
    await page.getByRole('button', { name: /Fide/ }).first().click()
    await page.getByRole('link', { name: /Bitirdim!/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Tebrikler Mert!' })).toBeVisible()
    await page.getByRole('link', { name: /Sertifikamı gör/ }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: /Küçük Çiftçiler sertifikası/ }),
    ).toBeAttached()

    await page.goto('rozetlerim')
    await expect(page.getByRole('heading', { level: 1, name: /Rozetlerim/ })).toBeVisible()
    const kitBadge = page.getByRole('listitem').filter({ hasText: 'Küçük Çiftçi' })
    await expect(kitBadge).toContainText('tarihinde kazandın')
    // No QR was scanned in this run, so the global badge stays locked.
    const firstQr = page.getByRole('listitem').filter({ hasText: 'İlk QR’ım' })
    await expect(firstQr).toContainText('Henüz kazanılmadı')
  })

  test('progress survives a reload (stored per explorer)', async ({ page }) => {
    await joinFromHome(page, 'Can')
    await page.goto('kit/kucuk-ciftciler/tohum-nedir')
    await page.getByRole('button', { name: 'Tohuma dokun!' }).click()
    await expect(page.getByText(/Filiz çıktı!/)).toBeVisible()

    await page.goto('kit/kucuk-ciftciler')
    await expect(page.getByText('1 / 7 kart tamamlandı')).toBeVisible()
    await page.reload()
    await expect(page.getByText('1 / 7 kart tamamlandı')).toBeVisible()
  })

  test('the finish page lists what is still missing', async ({ page }) => {
    await joinFromHome(page, 'Ece')
    await page.goto('kit/kucuk-ciftciler/tamamlandi')

    await expect(page.getByRole('heading', { level: 1, name: 'Az kaldı!' })).toBeVisible()
  })
})
