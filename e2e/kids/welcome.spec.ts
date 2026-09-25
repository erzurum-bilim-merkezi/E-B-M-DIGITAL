import { expect, joinAsExplorer, test } from '../support/test.ts'

test.describe('Kâşif membership', () => {
  test('a new device joins with a nickname and sees its restore code once', async ({ page }) => {
    await page.goto('')
    await expect(page).toHaveURL(/\/hosgeldin$/)

    await joinAsExplorer(page, 'Zeynep', 'Turkuaz Kâşif')

    await expect(page.getByRole('heading', { level: 1, name: 'Hoş geldin Zeynep!' })).toBeVisible()
    await expect(page.getByTestId('restore-code')).toHaveText(/^KSF-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    await page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Zeynep!' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Küçük Çiftçiler/ })).toBeVisible()
  })

  test('rejects empty and inappropriate nicknames with a spoken-friendly message', async ({
    page,
  }) => {
    await page.goto('hosgeldin')

    await page.getByRole('button', { name: /Devam/ }).click()
    await expect(page.getByRole('alert')).not.toBeEmpty()
    await expect(page.getByLabel('Adın')).toBeFocused()

    await page.getByLabel('Adın').fill('aptal')
    await page.getByRole('button', { name: /Devam/ }).click()
    await expect(page.getByRole('alert')).not.toBeEmpty()
    await expect(page.getByRole('heading', { name: 'Avatarını seç' })).toHaveCount(0)
  })

  test('shows the privacy notice without joining', async ({ page }) => {
    await page.goto('hosgeldin')
    await page.getByRole('link', { name: 'Aydınlatma metni' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Kâşif aydınlatma metni' }),
    ).toBeVisible()
  })
})
