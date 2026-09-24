import { expect, joinAsExplorer, openDevice, test, transferState } from '../support/test.ts'

/*
 * A shared tablet at the science centre (ADR 0009): an educator turns it into a centre device with
 * a one-time setup code from the Studio; after 90 s of inactivity the tablet hands over to the next
 * child (and forgets the previous one); leaving kiosk mode needs the educator PIN.
 */
test.use({ staff: 'admin' })

test('centre tablet: setup code, idle hand-over and PIN exit', async ({
  page: studio,
  browser,
  pageErrors,
}, testInfo) => {
  await studio.goto('studio/ayarlar')
  await studio.getByLabel('Cihaz adı').fill('Giriş tableti')
  await studio.getByLabel('Eğitmen PIN’i (4–8 rakam)').fill('2468')
  await studio.getByRole('button', { name: 'Kurulum kodu üret' }).click()
  const setupCode =
    (
      await studio
        .getByRole('dialog', { name: 'Kurulum kodu' })
        .getByTestId('center-setup-code')
        .textContent()
    )?.trim() ?? ''
  expect(setupCode.length).toBeGreaterThanOrEqual(6)

  const tablet = await openDevice(browser, testInfo, pageErrors, {
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
  })
  // Control time so the 90 s idle timer can be fast-forwarded.
  await tablet.page.clock.install()
  await tablet.page.goto('aydinlatma')
  await transferState(studio, tablet.page)

  await tablet.page.goto('hosgeldin')
  await joinAsExplorer(tablet.page, 'Ada')
  await tablet.page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()
  await tablet.page.goto('profil')
  await tablet.page.getByRole('button', { name: 'Eğitmen: bu cihazı merkez cihazı yap' }).click()
  await tablet.page.getByLabel('Kurulum kodu (Studio → Ayarlar)').fill(setupCode)
  await tablet.page.getByRole('button', { name: 'Merkez cihazı olarak kur' }).click()
  await expect(tablet.page.getByText(/Giriş tableti.*merkez modunda/)).toBeVisible()

  // Nobody touches the tablet: first a warning, then the goodbye card, then the next child.
  await tablet.page.goto('')
  await expect(tablet.page.getByRole('heading', { level: 1, name: 'Merhaba Ada!' })).toBeVisible()
  await tablet.page.clock.fastForward('01:35')
  await expect(tablet.page.getByRole('dialog', { name: 'Hâlâ orada mısın?' })).toBeVisible()
  await tablet.page.clock.fastForward('00:30')
  await expect(tablet.page.getByRole('heading', { name: /Görüşmek üzere Ada/ })).toBeVisible()
  await tablet.page.getByRole('button', { name: /Sıradaki kâşif/ }).click()
  await expect(tablet.page.getByRole('heading', { name: 'Kâşif’e hoş geldin' })).toBeVisible()

  // The previous child is gone from this device.
  await joinAsExplorer(tablet.page, 'Can')
  await tablet.page.getByRole('button', { name: /Bilim Merkezine gir/ }).click()
  await tablet.page.goto('profil')
  await expect(tablet.page.getByText('Ada', { exact: true })).toHaveCount(0)

  // Leaving kiosk mode needs the PIN.
  await tablet.page.getByLabel('Eğitmen PIN’i').fill('1111')
  await tablet.page.getByRole('button', { name: 'Merkez modundan çık' }).click()
  await expect(tablet.page.getByRole('alert').filter({ hasText: /PIN/ })).toBeVisible()
  await tablet.page.getByLabel('Eğitmen PIN’i').fill('2468')
  await tablet.page.getByRole('button', { name: 'Merkez modundan çık' }).click()
  await expect(tablet.page.getByRole('heading', { level: 1, name: 'Merhaba Can!' })).toBeVisible()

  await tablet.context.close()
})
