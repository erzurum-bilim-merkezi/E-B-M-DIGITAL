import { expect, test } from '../support/test.ts'

test.describe('Administration', () => {
  test.use({ staff: 'admin' })

  test('a new editor gets a one-time password and must choose their own on first sign-in', async ({
    page,
  }) => {
    await page.goto('studio/kullanicilar')
    await page.getByRole('button', { name: 'Kullanıcı ekle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Kullanıcı ekle' })
    await dialog.getByLabel('Ad soyad').fill('Ayşe Yılmaz')
    await dialog.getByLabel('E-posta').fill('ayse.yilmaz@kasif.dev')
    await dialog.getByRole('button', { name: 'Kullanıcıyı oluştur' }).click()

    const temporary = (await page.getByTestId('temp-password').textContent())?.trim() ?? ''
    expect(temporary.length).toBeGreaterThanOrEqual(12)
    await page.getByRole('button', { name: 'Kaydettim, kapat' }).click()
    await expect(page.getByText('ayse.yilmaz@kasif.dev')).toBeVisible()

    // Sign out, sign in as the new editor with the temporary password.
    await page.getByRole('button', { name: /Hesap menüsü/ }).click()
    await page.getByRole('menuitem', { name: /Çıkış yap/ }).click()
    await page.getByLabel('E-posta').fill('ayse.yilmaz@kasif.dev')
    await page.getByRole('textbox', { name: 'Parola', exact: true }).fill(temporary)
    await page.getByRole('button', { name: 'Giriş yap' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Yeni parolanızı belirleyin' }),
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Yeni parola', exact: true }).fill('Gunes.Isigi.2031')
    await page.getByRole('textbox', { name: 'Yeni parola (tekrar)' }).fill('Gunes.Isigi.2031')
    await page.getByRole('button', { name: 'Parolayı kaydet' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Ayşe' })).toBeVisible()
  })

  test('a centre device gets a one-time setup code', async ({ page }) => {
    await page.goto('studio/ayarlar')
    await page.getByLabel('Cihaz adı').fill('Giriş tableti 1')
    await page.getByLabel('Eğitmen PIN’i (4–8 rakam)').fill('2468')
    await page.getByRole('button', { name: 'Kurulum kodu üret' }).click()

    const dialog = page.getByRole('dialog', { name: 'Kurulum kodu' })
    await expect(dialog.getByTestId('center-setup-code')).toHaveText(/\S{6,}/)
    await dialog.getByRole('button', { name: 'Tamam' }).click()
    await expect(page.getByRole('cell', { name: 'Giriş tableti 1', exact: true })).toBeVisible()
    await expect(page.getByText('Kurulum bekliyor')).toBeVisible()
  })

  test('turning the AI provider off hides every AI entry point', async ({ page }) => {
    await page.goto('studio/ayarlar')
    await page.getByLabel(/Sağlayıcı/).selectOption('off')
    await expect(page.getByText('Kapalı', { exact: true })).toBeVisible()

    await page.goto('studio/kitler/yeni')
    await expect(page.getByRole('radio', { name: /Yapay zekâyla taslak/ })).toHaveCount(0)
  })

  test('the audit log records publishing', async ({ page }) => {
    await page.goto('studio/ayarlar')
    await expect(
      page.getByRole('table', { name: 'Denetim kaydı' }).getByText('kit.published').first(),
    ).toBeVisible()
  })
})
