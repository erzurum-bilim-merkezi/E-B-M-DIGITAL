import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Runs against the coming-soon build (see playwright.config.ts) — the public site's configuration.

test.describe('Coming-soon mode', () => {
  test('shows the under-construction page on the home page', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Çalışmalar devam ediyor')
    await expect(page.getByText('Yapım aşamasında')).toBeVisible()
    await expect(page).toHaveTitle('Çalışmalar devam ediyor | Erzurum Bilim Merkezi')
  })

  test('shows the same page for any deep link', async ({ page }) => {
    await page.goto('/etkinlikler/2026')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Çalışmalar devam ediyor')
  })

  test('is dark from the first paint', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('loads the self-hosted display font', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return document.fonts.check('600 48px "Bricolage Grotesque Variable"', 'Çalışmalar')
    })
    expect(loaded).toBe(true)
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no detectable WCAG 2.2 AA violations (${colorScheme} OS theme)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()

      expect(violations).toEqual([])
    })
  }
})
