import { expect, test } from '../support/test.ts'

test.describe('Editor permissions', () => {
  test.use({ staff: 'editor' })

  for (const path of ['studio/kullanicilar', 'studio/kasifler']) {
    test(`${path} answers 403 for editors`, async ({ page }) => {
      await page.goto(path)

      await expect(page.getByRole('alert')).toContainText('Bu sayfa için yetkiniz yok')
      await page.getByRole('link', { name: 'Panoya dön' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Elif' })).toBeVisible()
    })
  }

  test('the live feed hides explorer identities from editors (KVKK)', async ({ page }) => {
    await page.goto('studio')

    await expect(page.getByRole('heading', { name: 'Canlı etkinlik' })).toBeVisible()
    await expect(page.getByRole('link', { name: /#[0-9A-Z]{4}/ })).toHaveCount(0)
  })
})
