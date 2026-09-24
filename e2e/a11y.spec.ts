import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const pages = ['/', '/this-route-does-not-exist']
const colorSchemes = ['light', 'dark'] as const

// Every page must pass WCAG 2.2 AA in both themes — contrast issues often only exist in one.
for (const colorScheme of colorSchemes) {
  test.describe(`Accessibility (WCAG 2.2 AA, ${colorScheme})`, () => {
    test.use({ colorScheme })

    for (const path of pages) {
      test(`${path} has no detectable violations`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()

        expect(violations).toEqual([])
      })
    }
  })
}
