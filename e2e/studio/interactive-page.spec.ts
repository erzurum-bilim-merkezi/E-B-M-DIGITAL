import { expect, test } from '../support/test.ts'

test.describe('Etkileşimli sayfa kiti (admin)', () => {
  test.use({ staff: 'admin' })

  test('designs a page with AI in the wizard, tries it and creates the kit', async ({ page }) => {
    await page.goto('studio/kitler/yeni')
    await page.getByRole('radio', { name: /^Etkileşimli sayfa/ }).click()
    await page.getByLabel('Sayfada ne olsun?').fill('Dünya ve çevresinde dönen Ay')
    await page.getByRole('button', { name: 'Sayfayı tasarla' }).click()

    await expect(page.getByText(/^Sayfa hazır\. Önizlemede/)).toBeVisible()
    const preview = page.frameLocator('iframe[title^="Önizleme"]')
    await expect(preview.getByRole('img', { name: /Dünya ve etrafında dönen Ay/ })).toBeVisible()

    await page.getByRole('button', { name: /Devam/ }).click()
    await expect(page.getByLabel('Kit adı')).toHaveValue('Dünya ve çevresinde dönen Ay')
    await page.getByLabel('Kit adı').fill('Dünya ve Ay')
    await page.getByRole('button', { name: /Devam/ }).click()
    await page.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Dünya ve Ay' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Kartlar' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Yeniden tasarla' })).toBeVisible()
  })

  test('closes a hand-written page that takes its frame elsewhere', async ({ page }) => {
    await page.goto('studio/kitler/yeni')
    await page.getByRole('radio', { name: /^Etkileşimli sayfa/ }).click()
    await page.getByLabel('Sayfada ne olsun?').fill('Dünya ve Ay')
    await page.getByRole('button', { name: 'Sayfayı tasarla' }).click()
    await page.getByRole('button', { name: /Devam/ }).click()
    await page.getByRole('button', { name: /Devam/ }).click()
    await page.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()
    await expect(page.getByRole('button', { name: 'Yeniden tasarla' })).toBeVisible()

    // The page check cannot see through `'loca' + 'tion'`: the frame itself must catch it. (A
    // reload stands in for any address: the app's frame-src already refuses data:, blob: and http:.)
    await page.getByText('HTML’i düzenle (ileri düzey)').click()
    await page
      .getByLabel('Sayfanın HTML’i')
      .fill(
        `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kaçış</title></head><body><p>Merhaba</p><script>setTimeout(() => { window['loca' + 'tion'].reload() }, 300)</script></body></html>`,
      )

    await expect(page.getByText('Sayfa kapatıldı', { exact: true })).toBeVisible()
    await expect(page.locator('iframe[title^="Önizleme"]')).toHaveCount(0)
  })

  test('takes an https link of another site, never a plain http one', async ({ page }) => {
    await page.goto('studio/kitler/yeni')
    await page.getByRole('radio', { name: /^Etkileşimli sayfa/ }).click()
    await page.getByRole('radio', { name: 'Hazır bağlantı' }).click()
    const link = page.getByLabel('Sayfanın bağlantısı')

    await link.fill('http://phet.colorado.edu/sims/a.html')
    await page.getByRole('button', { name: /Devam/ }).click()
    // The error sits on the field, which takes the focus (not a second alert above the form).
    await expect(link).toBeFocused()
    await expect(link).toHaveAccessibleDescription(/Yalnızca https:\/\//)
    await expect(page.getByText(/^Yalnızca https:\/\//)).toHaveCount(1)

    await link.fill('https://phet.colorado.edu/sims/a_tr.html')
    // Nothing is requested from the site until the editor asks for a preview.
    await expect(page.locator('iframe')).toHaveCount(0)
    await page.getByRole('button', { name: /Devam/ }).click()
    await expect(page.getByLabel('Kit adı')).toBeVisible()
  })
})
