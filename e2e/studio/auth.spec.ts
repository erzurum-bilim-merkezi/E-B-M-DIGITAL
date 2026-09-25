import { expect, STAFF, test, totp } from '../support/test.ts'

// The only specs that sign in through the UI; everything else injects a session (support/test.ts).

test.describe('Studio sign-in', () => {
  test('an editor signs in with e-mail and password', async ({ page }) => {
    await page.goto('studio/giris')
    await page.getByLabel('E-posta').fill(STAFF.editor.email)
    await page.getByRole('textbox', { name: 'Parola', exact: true }).fill(STAFF.editor.password)
    await page.getByRole('button', { name: 'Giriş yap' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Elif' })).toBeVisible()
    // Editors don't see admin-only areas.
    const nav = page.getByRole('navigation', { name: 'Studio' })
    await expect(nav.getByRole('link', { name: 'Kâşif Kitleri' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Kullanıcılar' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Kâşifler' })).toHaveCount(0)
  })

  test('a wrong password is refused without revealing which field was wrong', async ({ page }) => {
    await page.goto('studio/giris')
    await page.getByLabel('E-posta').fill(STAFF.editor.email)
    await page.getByRole('textbox', { name: 'Parola', exact: true }).fill('yanlis-parola')
    await page.getByRole('button', { name: 'Giriş yap' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/studio\/giris/)
  })

  test('admins need the second factor (TOTP) and return to the page they asked for', async ({
    page,
  }) => {
    await page.goto('studio/kitler')
    await expect(page).toHaveURL(/\/studio\/giris\?donus=/)

    await page.getByLabel('E-posta').fill(STAFF.admin.email)
    await page.getByRole('textbox', { name: 'Parola', exact: true }).fill(STAFF.admin.password)
    await page.getByRole('button', { name: 'Giriş yap' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'İki adımlı doğrulama' }),
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Doğrulama kodu' }).fill(totp())
    await page.getByRole('button', { name: 'Doğrula ve devam et' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Kâşif Kitleri' })).toBeVisible()
  })

  test('signing out ends the session', async ({ page }) => {
    await page.goto('studio/giris')
    await page.getByLabel('E-posta').fill(STAFF.editor.email)
    await page.getByRole('textbox', { name: 'Parola', exact: true }).fill(STAFF.editor.password)
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Merhaba Elif' })).toBeVisible()

    await page.getByRole('button', { name: /Hesap menüsü/ }).click()
    await page.getByRole('menuitem', { name: /Çıkış yap/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Studio’ya giriş' })).toBeVisible()
    await page.goto('studio')
    await expect(page).toHaveURL(/\/studio\/giris/)
  })
})
