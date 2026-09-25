import type { Locator, Page } from '@playwright/test'

import { expect, SEEDS, test } from '../support/test.ts'

/*
 * WCAG 1.4.10 Reflow: at 320 CSS px nothing may need horizontal page scrolling. Wide data
 * tables may scroll inside their own box — but the page itself must not pan sideways.
 */

async function pageOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

test.describe('Reflow at 320 px · Studio', () => {
  test.use({ staff: 'admin', seed: SEEDS.demo, viewport: { width: 320, height: 720 } })

  test('no Studio page scrolls sideways', async ({ page }) => {
    test.slow()
    await page.goto('studio/kitler')
    const href = await page
      .getByRole('link', { name: 'Küçük Çiftçiler' })
      .first()
      .getAttribute('href')
    const kit = (href ?? '').replace(/^\/E-B-M-DIGITAL\//, '')

    // Each page with what shows that its content (tables, filters, fields) has rendered.
    const pages: [path: string, ready: (page: Page) => Locator][] = [
      ['studio', (p) => p.getByRole('heading', { name: 'Kotalar' })],
      ['studio/kitler', (p) => p.getByRole('link', { name: 'Küçük Çiftçiler' }).first()],
      [`${kit}?sekme=genel`, (p) => p.getByRole('textbox', { name: 'Kit adı' })],
      [`${kit}?sekme=kartlar`, (p) => p.getByRole('list', { name: 'Kartlar' })],
      ['studio/analitik', (p) => p.getByRole('table', { name: 'Kit karşılaştırması' })],
      ['studio/medya', (p) => p.getByRole('radiogroup', { name: 'Tür' })],
      ['studio/kasifler', (p) => p.getByRole('table', { name: 'Kâşifler' })],
      ['studio/kullanicilar', (p) => p.getByRole('table', { name: 'Studio kullanıcıları' })],
      ['studio/ayarlar', (p) => p.getByRole('heading', { level: 1 })],
    ]

    const overflowing: Record<string, number> = {}
    for (const [path, ready] of pages) {
      await page.goto(path)
      await expect(ready(page)).toBeAttached()
      const overflow = await pageOverflow(page)
      if (overflow > 0) overflowing[path] = overflow
    }
    expect(overflowing).toEqual({})
  })
})
