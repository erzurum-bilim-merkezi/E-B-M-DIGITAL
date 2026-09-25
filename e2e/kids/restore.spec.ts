import {
  expect,
  joinFromHome,
  openDevice,
  test,
  transferState,
  waitForEventsSent,
} from '../support/test.ts'

test.describe('Continuing on another device', () => {
  test('the Kâşif code restores the membership and its progress elsewhere', async ({
    page,
    browser,
    pageErrors,
  }, testInfo) => {
    const code = await joinFromHome(page, 'Selin')
    await page.goto('kit/kucuk-ciftciler/tohum-nedir')
    await page.getByRole('button', { name: 'Tohuma dokun!' }).click()
    await expect(page.getByText(/Filiz çıktı!/)).toBeVisible()
    await waitForEventsSent(page)

    // A second device shares the (mock) server, but not the first device's local keys.
    const { context: other, page: second } = await openDevice(browser, testInfo, pageErrors)
    await second.goto('aydinlatma')
    await transferState(page, second)

    await second.goto('giris')
    await second.getByLabel('Kâşif kodun').fill(code)
    await second.getByRole('button', { name: /Giriş yap/ }).click()

    await expect(second.getByRole('heading', { level: 1, name: 'Merhaba Selin!' })).toBeVisible()
    await second.goto('kit/kucuk-ciftciler')
    await expect(second.getByText('1 / 7 kart tamamlandı')).toBeVisible()
    await other.close()
  })

  test('a wrong code is rejected with the remaining attempts', async ({ page }) => {
    await page.goto('giris')
    await page.getByLabel('Kâşif kodun').fill('KSF-AAAA-BBBB')
    await page.getByRole('button', { name: /Giriş yap/ }).click()

    await expect(page.getByRole('alert')).toContainText(/deneme hakkın kaldı|bulunamadı|yanlış/i)
    await expect(page.getByLabel('Kâşif kodun')).toBeFocused()
  })
})
