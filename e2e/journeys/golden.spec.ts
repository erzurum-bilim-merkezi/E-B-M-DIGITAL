import { devices } from '@playwright/test'

import { decodePngQr, readZip } from '../support/qr.ts'
import {
  expect,
  joinAsExplorer,
  openDevice,
  test,
  transferState,
  waitForEventsSent,
} from '../support/test.ts'

/*
 * The golden journey (plan §0.4): an admin builds and publishes a kit in the Studio, prints its
 * QR codes; a child scans one on a phone, joins and plays; the Studio sees the activity.
 * The mock backend lives in each browser, so state moves between the two devices explicitly.
 */
test.use({ staff: 'admin' })

test('Studio → publish → QR → Kâşif on a phone → activity back in the Studio', async ({
  page: studio,
  browser,
  pageErrors,
}, testInfo) => {
  // 1 · Create a kit from the sample template and publish it.
  await studio.goto('studio/kitler/yeni')
  await studio.getByRole('radio', { name: /Örnek: Küçük Çiftçiler/ }).click()
  await studio.getByRole('button', { name: /Devam/ }).click()
  await studio.getByLabel('Kit adı').fill('Minik Bahçıvanlar')
  await studio.getByRole('button', { name: /Devam/ }).click()
  await studio.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()
  await expect(studio.getByRole('heading', { level: 1, name: 'Minik Bahçıvanlar' })).toBeVisible()

  await studio.getByRole('tab', { name: /Yayın/ }).click()
  await studio.getByRole('button', { name: 'Yayınla', exact: true }).click()
  await expect(studio.getByText('v1 yayınlandı')).toBeVisible()

  // 2 · Download the QR codes and read the first card's code from its PNG.
  await studio.getByRole('link', { name: /QR/ }).first().click()
  await expect(studio.getByRole('heading', { level: 1, name: 'QR kodları' })).toBeVisible()
  const downloadPromise = studio.waitForEvent('download')
  await studio.getByRole('button', { name: 'Tümünü indir (ZIP)' }).click()
  const files = await readZip(await (await downloadPromise).path())
  const firstCard = files.find((file) => /-01-/.test(file.name) && file.name.endsWith('.png'))
  const url = decodePngQr(firstCard?.data ?? Buffer.alloc(0)) ?? ''
  const code = new URL(url).searchParams.get('q') ?? ''
  expect(code).toMatch(/^[A-Z]{2,4}-01$/)

  // 3 · A child scans it with the phone camera (the QR opens the site root + ?q=).
  const phone = await openDevice(browser, testInfo, pageErrors, devices['Pixel 7'])
  await phone.page.goto('aydinlatma')
  await transferState(studio, phone.page)
  await phone.page.goto(`?q=${code}`)
  await joinAsExplorer(phone.page, 'Kaan')
  await expect(phone.page.getByRole('heading', { level: 1, name: /Tohum nedir\?/ })).toBeVisible()
  await phone.page.getByRole('button', { name: 'Tohuma dokun!' }).click()
  await expect(phone.page.getByText(/Filiz çıktı!/)).toBeVisible()

  // 4 · Back in the Studio, the scan and the new explorer show up.
  await waitForEventsSent(phone.page)
  await transferState(phone.page, studio)
  await studio.goto('studio')
  const feed = studio.getByRole('list').filter({ hasText: 'Kaan' })
  await expect(feed.getByText(new RegExp(`${code} QR’ını okuttu`))).toBeVisible()
  await studio.goto('studio/kasifler')
  await expect(studio.getByRole('link', { name: /Kaan/ })).toBeVisible()

  await phone.context.close()
})
