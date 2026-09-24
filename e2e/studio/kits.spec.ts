import { expect, test } from '../support/test.ts'

test.describe('Kâşif Kitleri (admin)', () => {
  test.use({ staff: 'admin' })

  test('lists kits with their state and filters by status in the URL', async ({ page }) => {
    await page.goto('studio/kitler')

    await expect(page.getByRole('heading', { level: 1, name: 'Kâşif Kitleri' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Küçük Çiftçiler' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mıknatıs Bilmecesi' })).toBeVisible()

    await page.getByLabel(/Durum/).selectOption({ label: 'Taslak' })
    await expect(page).toHaveURL(/durum=draft/)
    await expect(page.getByRole('link', { name: 'Mıknatıs Bilmecesi' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Küçük Çiftçiler' })).toHaveCount(0)
  })

  test('creates a kit with the wizard, adds a card and keeps it after a reload', async ({
    page,
  }) => {
    await page.goto('studio/kitler/yeni')
    await page.getByRole('radio', { name: /Boş kit/ }).click()
    await page.getByRole('button', { name: /Devam/ }).click()
    await page.getByLabel('Kit adı').fill('Işık ve Gölge')
    await page.getByRole('button', { name: /Devam/ }).click()
    await page.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Işık ve Gölge' })).toBeVisible()
    await page.getByRole('tab', { name: /Kartlar/ }).click()
    await page.getByRole('button', { name: 'Kart ekle' }).click()
    await page
      .getByRole('dialog', { name: 'Kart ekle' })
      .getByRole('button', { name: /Bilgi kartı/ })
      .click()

    const cards = page.getByRole('list', { name: 'Kartlar' })
    await expect(cards.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText('Kaydedildi')).toBeVisible()

    await page.reload()
    await page.getByRole('tab', { name: /Kartlar/ }).click()
    await expect(page.getByRole('list', { name: 'Kartlar' }).getByRole('listitem')).toHaveCount(1)
  })

  test('publishing an edit of a live kit creates a new immutable version', async ({ page }) => {
    await page.goto('studio/kitler')
    await page.getByRole('link', { name: 'Küçük Çiftçiler' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Küçük Çiftçiler' })).toBeVisible()

    await page.getByLabel(/Kısa açıklama/).fill('Marul serasını adım adım keşfet')
    await expect(page.getByText('Kaydedildi')).toBeVisible()

    await page.getByRole('tab', { name: /Yayın/ }).click()
    await page.getByLabel('Yayın notu (isteğe bağlı)').fill('Kısa açıklama güncellendi')
    await page.getByRole('button', { name: 'Yeni sürümü yayınla' }).click()
    await expect(page.getByText('v2 yayınlandı')).toBeVisible()

    const editorUrl = page.url()
    await page.goto(`${editorUrl.replace(/\?.*$/, '')}/surumler`)
    await expect(page.getByRole('heading', { level: 1, name: 'Sürümler' })).toBeVisible()
    await expect(page.getByRole('cell', { name: /v2/ })).toContainText('Canlı')
    await expect(page.getByRole('cell', { name: /v1/ })).toBeVisible()
  })
})

test.describe('Review workflow (editor)', () => {
  test.use({ staff: 'editor' })

  test('an editor withdraws a kit from review and sends it again', async ({ page }) => {
    await page.goto('studio/kitler')
    await page.getByRole('link', { name: 'Su Damlasının Yolculuğu' }).click()
    await page.getByRole('tab', { name: /Yayın/ }).click()

    await page.getByRole('button', { name: 'İncelemeden geri çek' }).click()
    await expect(page.getByText('İncelemeden geri çekildi')).toBeVisible()

    await page.getByRole('button', { name: 'İncelemeye gönder' }).click()
    await expect(page.getByText('İncelemeye gönderildi')).toBeVisible()
    // Editors can never publish.
    await expect(page.getByRole('button', { name: /^Yayınla$/ })).toHaveCount(0)
  })
})
