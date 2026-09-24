import { expect, test } from '@playwright/test'

test.describe('Home page', () => {
  test('renders the app shell', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })

  test('shows the 404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')

    await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible()
    await page.getByRole('link', { name: 'Ana sayfaya dön' }).click()
    await expect(page).toHaveURL('/')
  })
})
