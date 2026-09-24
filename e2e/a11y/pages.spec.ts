import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { expect, joinFromHome, SEEDS, test } from '../support/test.ts'

/*
 * WCAG 2.2 AA is a release requirement (CLAUDE.md): every route, both themes. Violations of all
 * pages in a group are collected first, so one run lists everything that needs fixing.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

type Findings = Record<
  string,
  { rule: string; impact: string | null | undefined; targets: string[] }[]
>

async function audit(page: Page, name: string, findings: Findings) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  if (violations.length > 0) {
    findings[name] = violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.slice(0, 4).map((node) => node.target.join(' ')),
    }))
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`WCAG 2.2 AA · ${colorScheme}`, () => {
    // Final frames only: entrance transitions would otherwise be measured mid-fade.
    test.use({ colorScheme, reducedMotion: 'reduce' })

    test('Kâşif: joining and public pages', async ({ page }) => {
      const findings: Findings = {}
      for (const path of ['hosgeldin', 'giris', 'aydinlatma']) {
        await page.goto(path)
        await audit(page, path, findings)
      }
      expect(findings).toEqual({})
    })

    test('Kâşif: member pages and all 13 card types', async ({ page }) => {
      test.slow()
      const findings: Findings = {}
      await joinFromHome(page, 'Duru')
      for (const path of [
        '',
        'kit/kucuk-ciftciler',
        'kit/kucuk-ciftciler/tamamlandi',
        'rozetlerim',
        'profil',
        'qr-okut',
        'sertifika/kucuk-ciftciler',
        'olmayan-sayfa',
      ]) {
        await page.goto(path)
        await audit(page, path || 'bilim-merkezi', findings)
      }

      await page.goto('kit/blok-vitrini')
      const cards = await page
        .getByRole('link')
        .evaluateAll((links) =>
          links
            .map((link) => link.getAttribute('href') ?? '')
            .filter(
              (href) => /\/kit\/blok-vitrini\/[^/]+$/.test(href) && !href.endsWith('/tamamlandi'),
            ),
        )
      expect(cards.length).toBe(13)
      for (const href of cards) {
        await page.goto(href.replace(/^\/E-B-M-DIGITAL\//, ''))
        await audit(page, href.split('/').pop() ?? href, findings)
      }
      expect(findings).toEqual({})
    })

    test.describe('Studio', () => {
      test.use({ staff: 'admin', seed: SEEDS.demo })

      test('Studio: every page', async ({ page }) => {
        test.slow()
        const findings: Findings = {}
        await page.goto('studio/kitler')
        const href = await page.getByRole('link', { name: 'Küçük Çiftçiler' }).getAttribute('href')
        const kit = (href ?? '').replace(/^\/E-B-M-DIGITAL\//, '')

        await page.goto('studio/kasifler')
        const explorerHref = await page
          .getByRole('table', { name: 'Kâşifler' })
          .getByRole('link')
          .first()
          .getAttribute('href')
        const explorer = (explorerHref ?? '').replace(/^\/E-B-M-DIGITAL\//, '')

        const paths = [
          'studio',
          'studio/kitler',
          'studio/kitler/yeni',
          `${kit}?sekme=genel`,
          `${kit}?sekme=kartlar`,
          `${kit}?sekme=tema`,
          `${kit}?sekme=rozet`,
          `${kit}?sekme=yayin`,
          `${kit}/surumler`,
          `${kit}/qr`,
          `${kit}/qr/yazdir`,
          `${kit}/qr/yazdir?sablon=etiket`,
          `${kit}/analiz`,
          `${kit}/onizleme`,
          'studio/analitik',
          'studio/medya',
          'studio/ayarlar',
          'studio/kasifler',
          explorer,
          'studio/kullanicilar',
          'studio/olmayan-sayfa',
        ]
        for (const path of paths) {
          await page.goto(path)
          await audit(page, path, findings)
        }
        expect(findings).toEqual({})
      })
    })

    test('Studio: sign-in', async ({ page }) => {
      const findings: Findings = {}
      await page.goto('studio/giris')
      await audit(page, 'studio/giris', findings)
      expect(findings).toEqual({})
    })
  })
}
