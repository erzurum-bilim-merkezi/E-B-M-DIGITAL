import type { Page } from '@playwright/test'

import { expect, joinFromHome, test } from '../support/test.ts'

/*
 * The two QR entry modes of a kit:
 * - "Her kart kendi QR'ı ile" (Küçük Çiftçiler): every card is opened by its own QR; after each
 *   card the child is asked for the next QR, and the card that finishes the kit gives the badge.
 * - "Bir QR yeter, sırayla devam" (Blok Vitrini): the kit's single QR starts the first card to
 *   play, and the child carries on card by card without scanning again — later scans resume.
 */

/** Plays card `number` of Küçük Çiftçiler (the interaction each block needs to complete). */
async function playKucukCiftcilerCard(page: Page, number: number) {
  switch (number) {
    case 1:
      await page.getByRole('button', { name: 'Tohuma dokun!' }).click()
      break
    case 2: {
      const slider = page.getByRole('slider', { name: 'Büyüme aşaması' })
      await slider.focus()
      await page.keyboard.press('End')
      break
    }
    case 3:
      for (const name of ['Işık', 'Su', 'Sıcaklık', 'Hava']) {
        await page.getByRole('button', { name, exact: true }).click()
      }
      break
    case 4:
      await page.getByRole('button', { name: /Işığı Aç!/ }).click()
      break
    case 5:
      // Animated scene: completes when viewed.
      break
    case 6:
      await page.getByRole('button', { name: 'Su', exact: true }).click()
      await page.getByRole('button', { name: 'Sıcaklık', exact: true }).click()
      break
    default:
      await page.getByRole('button', { name: /Tohum/ }).first().click()
      await page.getByRole('button', { name: /Fide/ }).first().click()
  }
}

test.describe('QR entry modes', () => {
  test('card by card: each card has its own QR and the last scan earns the badge', async ({
    page,
  }) => {
    await joinFromHome(page, 'Zeynep')

    for (let number = 1; number <= 7; number++) {
      await page.goto(`?q=KC-0${number}`)
      await expect(page).toHaveURL(/\?giris=qr$/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await playKucukCiftcilerCard(page, number)

      if (number < 7) {
        // Only this card: no "next card", the child scans the next QR.
        await expect(page.getByRole('link', { name: /Sıradaki kart ➜/ })).toHaveCount(0)
        await expect(page.getByRole('link', { name: /Sıradaki kartın QR'ını okut/ })).toBeVisible()
        await expect(
          page.getByText(`${number} / 7 kart tamamlandı`, { exact: false }),
        ).toBeVisible()
      }
    }

    await page.getByRole('link', { name: /Kiti bitirdin!/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Tebrikler Zeynep!' })).toBeVisible()

    await page.goto('rozetlerim')
    const kitBadge = page.getByRole('listitem').filter({ hasText: 'Küçük Çiftçi' })
    await expect(kitBadge).toContainText('tarihinde kazandın')
  })

  test('one QR: the kit QR starts the kit and the child goes on without scanning again', async ({
    page,
  }) => {
    await joinFromHome(page, 'Kerem')

    await page.goto('?q=BV')
    await expect(
      page.getByRole('heading', { level: 1, name: /Bitkiler de canlıdır/ }),
    ).toBeVisible()
    await page.getByRole('link', { name: /Sıradaki kart ➜/ }).click()
    await expect(page).toHaveURL(/\/kit\/blok-vitrini\/dokun-ve-kesfet$/)
    await expect(page.getByRole('heading', { level: 1, name: /Tohuma dokun/ })).toBeVisible()

    // Back at the Science Centre: the tile and the kit page lead to the next card to play.
    await page.goto('')
    await expect(page.getByRole('link', { name: /Blok Vitrini/ })).toContainText('Devam et')
    await page.getByRole('link', { name: /Blok Vitrini/ }).click()
    await expect(page.getByRole('link', { name: /Kaldığın yerden devam et/ })).toHaveAttribute(
      'href',
      /\/kit\/blok-vitrini\/dokun-ve-kesfet$/,
    )

    // Scanning the kit QR again resumes at the same card.
    await page.goto('?q=BV')
    await expect(page).toHaveURL(/\/kit\/blok-vitrini\/dokun-ve-kesfet$/)
  })
})
