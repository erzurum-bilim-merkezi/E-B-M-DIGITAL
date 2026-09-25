import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { devices, type Locator, type Page } from '@playwright/test'

import {
  expect,
  joinFromHome,
  openDevice,
  SEEDS,
  test,
  transferState,
  waitForEventsSent,
} from '../support/test.ts'
import {
  BLOCK_LABELS,
  PLANETS,
  UZAY_CARDS,
  UZAY_KIT,
  type ChooseCard,
  type IconPick,
  type MatchingCard,
  type QuizCard,
  type SequenceCard,
  type UzayCard,
} from '../support/uzay-kasifleri.ts'

/*
 * Real-scenario journey: an admin types the 10 "Uzay Kâşifleri" discoveries into Kâşif Studio
 * card by card (no fixtures, no imports), fixes what validation reports and publishes; a child
 * on a phone joins, solves every card (a wrong try first, then the right one), earns the badge
 * and opens a card by its QR code; the Studio then sees the child's activity.
 *
 * UZAY_REPORT=1 also saves screenshots + a manifest for docs/rapor/uzay (scripts/build-uzay-report.mjs).
 */

const REPORT = process.env['UZAY_REPORT'] === '1'
const REPORT_DIR = 'docs/rapor/uzay'
const shots: { file: string; caption: string; device: 'desktop' | 'phone' }[] = []

async function shot(page: Page, name: string, caption: string, fullPage = false) {
  if (!REPORT) return
  const device = (page.viewportSize()?.width ?? 1440) < 600 ? 'phone' : 'desktop'
  const file = `${name}.jpg`
  mkdirSync(path.join(REPORT_DIR, 'img'), { recursive: true })
  // Let entrance animations settle so the picture shows the final state.
  await page.waitForTimeout(400)
  // A full-page capture misplaces fixed/sticky chrome (Studio sidebar, header): grow the
  // viewport to the page height instead, then restore it.
  const viewport = page.viewportSize()
  const height = fullPage ? await page.evaluate(() => document.documentElement.scrollHeight) : 0
  if (viewport && height > viewport.height) {
    await page.setViewportSize({ width: viewport.width, height })
    await page.waitForTimeout(200)
  }
  await page.screenshot({
    path: path.join(REPORT_DIR, 'img', file),
    type: 'jpeg',
    quality: 62,
    scale: 'css',
    animations: 'disabled',
  })
  if (viewport && height > viewport.height) await page.setViewportSize(viewport)
  shots.push({ file, caption, device })
}

const nn = (index: number) => String(index + 1).padStart(2, '0')

// ── Studio helpers ──────────────────────────────────────────────────────────────────────────

async function expectSaved(studio: Page) {
  await expect(studio.getByText('Kaydedildi')).toBeVisible()
}

async function pickCardIcon(studio: Page, icon: IconPick) {
  await studio.getByRole('button', { name: 'Kart ikonu' }).click()
  const picker = studio.getByRole('dialog').filter({ has: studio.getByLabel('İkon ara') })
  if (icon.custom) {
    await picker.getByLabel('Başka bir emoji').fill(icon.emoji)
    await picker.getByRole('button', { name: 'Kullan' }).click()
  } else {
    await picker.getByRole('option', { name: icon.emoji, exact: true }).first().click()
  }
  await expect(studio.getByRole('button', { name: 'Kart ikonu' })).toContainText(
    `Emoji ${icon.emoji}`,
  )
}

async function pickEmojiStage(studio: Page) {
  const scenes = studio.getByRole('radiogroup', { name: 'Hazır sahneler' })
  if (!(await scenes.isVisible())) await studio.getByRole('tab', { name: /Hazır sahne/ }).click()
  await scenes.getByRole('radio', { name: /^Emoji sahnesi/ }).click()
  await expect(scenes.getByRole('radio', { name: /^Emoji sahnesi/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
}

async function fillCommon(studio: Page, card: UzayCard) {
  await studio.getByLabel('Soru / kart başlığı').fill(card.title)
  await pickCardIcon(studio, card.icon)
  await studio.getByLabel('Cevap', { exact: true }).fill(card.answer)
  await studio.getByLabel('Anlatım (Dinle)').fill(card.narration)
  await studio.getByLabel('İpucu').fill(card.hint)
  await studio.getByLabel('Kutlama mesajı').fill(card.celebration)
}

async function setSwitch(control: Locator, on: boolean) {
  if (((await control.getAttribute('aria-checked')) === 'true') !== on) await control.click()
  await expect(control).toHaveAttribute('aria-checked', String(on))
}

async function fillChoose(studio: Page, card: ChooseCard) {
  await pickEmojiStage(studio)
  await studio.getByLabel('Yönerge').fill(card.prompt)
  for (const [index, option] of card.options.entries()) {
    await studio.getByLabel('Seçenek adı').nth(index).fill(option.label)
    await studio.getByLabel('Emoji', { exact: true }).nth(index).fill(option.icon)
    await setSwitch(
      studio.getByRole('switch', { name: 'Doğru seçenek' }).nth(index),
      option.correct,
    )
    await studio.getByLabel('Geri bildirim').nth(index).fill(option.feedback)
  }
  await studio.getByLabel('Başarı mesajı').fill(card.success)
}

async function fillQuiz(studio: Page, card: QuizCard) {
  await pickEmojiStage(studio)
  await studio.getByRole('textbox', { name: 'Soru', exact: true }).fill(card.question)
  for (const [index, label] of card.options.entries()) {
    await studio.getByLabel('Seçenek metni').nth(index).fill(label)
  }
  const correct = card.options[card.correct] ?? ''
  const answers = studio.getByRole('radiogroup', { name: 'Doğru cevap' })
  await answers.getByRole('radio', { name: correct }).click()
  await expect(answers.getByRole('radio', { name: correct })).toBeChecked()
  await studio.getByLabel('Açıklama', { exact: true }).fill(card.explanation)
}

async function fillSequence(studio: Page, card: SequenceCard) {
  await studio.getByLabel('Yönerge').fill(card.prompt)
  const add = studio.getByRole('button', { name: 'Adım ekle' })
  while (
    (await studio.getByRole('textbox', { name: 'Adım', exact: true }).count()) < card.items.length
  ) {
    await add.click()
  }
  // 8 planets: the list is full, so "Adım ekle" turns off (limit raised from 6 to 8).
  await expect(add).toBeDisabled()
  for (const [index, item] of card.items.entries()) {
    await studio.getByRole('textbox', { name: 'Adım', exact: true }).nth(index).fill(item.label)
    await studio.getByLabel('Emoji', { exact: true }).nth(index).fill(item.icon)
  }
  await studio.getByLabel('Başarı mesajı').fill(card.success)
}

async function fillMatching(studio: Page, card: MatchingCard) {
  await studio.getByLabel('Yönerge').fill(card.prompt)
  const add = studio.getByRole('button', { name: 'Eş ekle' })
  while ((await studio.getByRole('textbox', { name: 'Sol kart' }).count()) < card.pairs.length)
    await add.click()
  for (const [index, pair] of card.pairs.entries()) {
    await studio.getByRole('textbox', { name: 'Sol kart' }).nth(index).fill(pair.left)
    await studio.getByRole('textbox', { name: 'Sağ kart (eşi)' }).nth(index).fill(pair.right)
  }
  await studio.getByLabel('Başarı mesajı').fill(card.success)
}

async function addCard(studio: Page, card: UzayCard) {
  await studio.getByRole('button', { name: 'Kart ekle' }).click()
  await studio
    .getByRole('dialog', { name: 'Kart ekle' })
    .getByRole('button', { name: new RegExp(`^${BLOCK_LABELS[card.kind]} `) })
    .click()
  await fillCommon(studio, card)
  if (card.kind === 'choose') await fillChoose(studio, card)
  if (card.kind === 'quiz') await fillQuiz(studio, card)
  if (card.kind === 'sequence') await fillSequence(studio, card)
  if (card.kind === 'matching') await fillMatching(studio, card)
  await expectSaved(studio)
}

// ── Kâşif (child) helpers ───────────────────────────────────────────────────────────────────

async function expectCard(page: Page, card: UzayCard) {
  await expect(page.getByRole('heading', { level: 1, name: card.title })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cevap' })).toContainText(
    card.answer.replace(/\*\*/g, '').split('\n')[0]?.slice(0, 40) ?? '',
  )
  if (card.kind === 'choose' || card.kind === 'quiz') {
    // The emoji stage shows the card icon big (it used to fall back to ✨ on these blocks).
    await expect(page.getByRole('img', { name: card.title })).toContainText(card.icon.emoji)
  }
}

async function playChoose(page: Page, card: ChooseCard) {
  const wrong = card.options.find((option) => !option.correct)
  const right = card.options.filter((option) => option.correct)
  if (wrong) {
    await page.getByRole('button', { name: wrong.label, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: wrong.feedback })).toBeVisible()
  }
  for (const option of right) {
    await page.getByRole('button', { name: option.label, exact: true }).click()
  }
  await expect(page.getByRole('status').filter({ hasText: card.success })).toBeVisible()
}

async function playQuiz(page: Page, card: QuizCard) {
  const wrong = card.options.find((_, index) => index !== card.correct) ?? ''
  const right = card.options[card.correct] ?? ''
  await page.getByRole('radio', { name: wrong }).check()
  await page.getByRole('button', { name: 'Cevabımı kontrol et' }).click()
  await expect(page.getByText('Hmm, bu değil. Bir daha dene! 💪')).toBeVisible()
  await expect(page.getByRole('radio', { name: wrong })).toBeDisabled()
  await page.getByRole('radio', { name: right }).check()
  await page.getByRole('button', { name: 'Cevabımı kontrol et' }).click()
  await expect(page.getByText(`✅ Doğru! ${card.explanation}`)).toBeVisible()
}

async function currentOrder(list: Locator) {
  const labels: string[] = []
  const rows = list.getByRole('listitem')
  for (let index = 0; index < (await rows.count()); index++) {
    const text = (await rows.nth(index).getByRole('button').first().innerText()).trim()
    labels.push(PLANETS.find((planet) => text.includes(planet.label))?.label ?? text)
  }
  return labels
}

/** A sequence card's main button (after a check its name ends with "(doğru/yanlış yerde)"). */
function planetButton(list: Locator, label: string) {
  return list.getByRole('button', { name: new RegExp(`^${label}( [(](doğru|yanlış) yerde[)])?$`) })
}

async function playSequence(page: Page, card: SequenceCard) {
  const list = page.getByRole('list', { name: 'Sıralanacak kartlar' })
  await expect(list.getByRole('listitem')).toHaveCount(card.items.length)
  const target = card.items.map((item) => item.label)
  const shuffled = await currentOrder(list)
  expect(shuffled, 'the player shuffles the planets').not.toEqual(target)

  // A first check with the shuffled order is wrong …
  await page.getByRole('button', { name: 'Sıramı kontrol et' }).click()
  await expect(list.getByText('yanlış yerde').first()).toBeAttached()

  // … then tap-to-swap every planet into place (tap one card, then the card to swap with).
  for (let index = 0; index < target.length; index++) {
    const order = await currentOrder(list)
    const wanted = target[index] ?? ''
    if (order[index] === wanted) continue
    await planetButton(list, order[index] ?? '').click()
    await planetButton(list, wanted).click()
  }
  expect(await currentOrder(list)).toEqual(target)
  await page.getByRole('button', { name: 'Sıramı kontrol et' }).click()
  await expect(page.getByText(card.success)).toBeVisible()
}

async function playMatching(page: Page, card: MatchingCard) {
  const left = page.getByRole('list', { name: 'Sol kartlar' })
  const right = page.getByRole('list', { name: 'Sağ kartlar' })
  const leftCard = (text: string) =>
    left.getByRole('button', { name: new RegExp(`^${escape(text)}`) })
  const rightCard = (text: string) =>
    right.getByRole('button', { name: new RegExp(`^${escape(text)}`) })
  const [first, second, ...rest] = card.pairs
  if (!first || !second) throw new Error('The final mission needs at least two pairs')

  // A wrong partner shakes; the left card stays chosen, so the child just tries another one.
  await leftCard(first.left).click()
  await expect(leftCard(first.left)).toHaveAttribute('aria-pressed', 'true')
  await rightCard(second.right).click()
  await expect(page.getByText('Bu ikisi eş değil. Tekrar dene! 😊')).toBeVisible()
  await rightCard(first.right).click()
  await expect(leftCard(first.left)).toHaveAccessibleName(`${first.left} (eşleşti: ${first.right})`)

  for (const pair of [second, ...rest]) {
    await leftCard(pair.left).click()
    await rightCard(pair.right).click()
  }
  await expect(page.getByRole('status').filter({ hasText: card.success })).toBeVisible()
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── The journey ─────────────────────────────────────────────────────────────────────────────

// An empty backend: the only kit is the one typed in below.
test.use({ staff: 'admin', seed: SEEDS.empty, actionTimeout: 15_000 })

test('Uzay Kâşifleri: Studio’da 10 kart elle girilir, yayınlanır, Kâşif’te baştan sona oynanır', async ({
  page: studio,
  browser,
  pageErrors,
}, testInfo) => {
  test.setTimeout(8 * 60_000)

  await test.step('Studio · sihirbazla boş kit oluştur', async () => {
    await studio.goto('studio/kitler/yeni')
    await studio.getByRole('radio', { name: /Boş kit/ }).click()
    await studio.getByRole('button', { name: /Devam/ }).click()
    await studio.getByLabel('Kit adı').fill(UZAY_KIT.title)
    await expect(studio.getByLabel('Adres')).toHaveValue(UZAY_KIT.slug)
    await studio.getByLabel('QR öneki').fill(UZAY_KIT.qrPrefix)
    await studio.getByLabel('Kit ikonu', { exact: true }).fill(UZAY_KIT.icon)
    await expect(studio.getByText(`Kit QR kodu: ${UZAY_KIT.qrPrefix}`)).toBeVisible()
    await shot(
      studio,
      's01-sihirbaz-ad',
      'Sihirbaz · kit adı, adres (uzay-kasifleri) ve QR öneki UZAY',
    )
    await studio.getByRole('button', { name: /Devam/ }).click()

    await studio.getByLabel('Kısa açıklama').fill(UZAY_KIT.tagline)
    await studio.getByLabel('Açıklama', { exact: true }).fill(UZAY_KIT.description)
    await studio.getByLabel('Kategori').selectOption({ label: UZAY_KIT.category })
    await studio.getByLabel('En küçük yaş').fill(UZAY_KIT.ageMin)
    await studio.getByLabel('En büyük yaş').fill(UZAY_KIT.ageMax)
    await studio.getByLabel('Süre').fill(UZAY_KIT.duration)
    await shot(
      studio,
      's02-sihirbaz-ayrinti',
      'Sihirbaz · açıklama, Uzay kategorisi, 6–10 yaş, 25 dk',
    )
    await studio.getByRole('button', { name: 'Oluştur ve kartları ekle' }).click()
    await expect(studio.getByRole('heading', { level: 1, name: UZAY_KIT.title })).toBeVisible()
  })

  await test.step('Studio · kartsız kit yayınlanamaz (doğrulama)', async () => {
    await studio.getByRole('tab', { name: /Yayın/ }).click()
    await expect(studio.getByText('En az bir kart ekleyin.')).toBeVisible()
    await expect(studio.getByRole('button', { name: 'Yayınla', exact: true })).toBeDisabled()
    await shot(
      studio,
      's03-yayin-engeli',
      'Yayın sekmesi · kart yokken “Yayınla” kapalı, sorun listesi görünür',
    )
  })

  await test.step('Studio · tema ve rozet', async () => {
    await studio.getByRole('tab', { name: /Tema/ }).click()
    const presets = studio.getByRole('radiogroup', { name: 'Tema ön ayarı' })
    await presets.getByRole('radio', { name: UZAY_KIT.theme }).click()
    await expect(presets.getByRole('radio', { name: UZAY_KIT.theme })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expectSaved(studio)
    await shot(studio, 's04-tema', 'Tema · Uzay ön ayarı')

    await studio.getByRole('tab', { name: /Rozet/ }).click()
    await studio.getByLabel('Rozet adı').fill(UZAY_KIT.badge.name)
    await studio.getByRole('textbox', { name: 'Rozet simgesi' }).fill(UZAY_KIT.badge.emoji)
    await studio.getByLabel('Rozet açıklaması').fill(UZAY_KIT.badge.description)
    await expectSaved(studio)
    await shot(studio, 's05-rozet', 'Rozet · “Uzay Kâşifi” 🚀 ve açıklaması')
  })

  await test.step('Studio · 10 keşif kartını tek tek gir', async () => {
    await studio.getByRole('tab', { name: /Kartlar/ }).click()
    const list = studio.getByRole('list', { name: 'Kartlar' })
    for (const [index, card] of UZAY_CARDS.entries()) {
      await test.step(`Kart ${index + 1}: ${card.title} (${BLOCK_LABELS[card.kind]})`, async () => {
        await addCard(studio, card)
        await expect(list.getByRole('listitem')).toHaveCount(index + 1)
        // "Bir QR yeter": cards have no QR of their own in the editor.
        await expect(studio.getByText(`QR ${UZAY_KIT.qrPrefix}-${nn(index)}`)).toHaveCount(0)
        await shot(
          studio,
          `s${10 + index}-kart-${nn(index)}`,
          `Kart ${index + 1} · ${card.title} — ${BLOCK_LABELS[card.kind]}`,
          true,
        )
      })
    }
  })

  await test.step('Studio · yenileme sonrası 10 kart korunur', async () => {
    await studio.reload()
    await studio.getByRole('tab', { name: /Kartlar/ }).click()
    await expect(studio.getByRole('list', { name: 'Kartlar' }).getByRole('listitem')).toHaveCount(
      UZAY_CARDS.length,
    )
  })

  await test.step('Studio · doğrulama temiz, yayınla', async () => {
    await studio.getByRole('tab', { name: /Yayın/ }).click()
    await expect(studio.getByText('Yayına hazır: sorun bulunmadı.')).toBeVisible()
    await shot(studio, 's30-yayina-hazir', 'Yayın · 10 kart, sorun yok')
    await studio.getByLabel('Yayın notu (isteğe bağlı)').fill('Uzay Kâşifleri: 10 keşif')
    await studio.getByRole('button', { name: 'Yayınla', exact: true }).click()
    await expect(studio.getByText('v1 yayınlandı')).toBeVisible()
    await shot(studio, 's31-yayinlandi', 'Yayın · v1 yayınlandı')

    await studio.goto('studio/kitler')
    const row = studio.getByRole('row').filter({ hasText: UZAY_KIT.title })
    await expect(row).toContainText('Yayında')
    await shot(studio, 's32-kit-listesi', 'Kâşif Kitleri · Uzay Kâşifleri yayında')
  })

  const phone = await openDevice(browser, testInfo, pageErrors, devices['Pixel 7'])
  const kid = phone.page

  await test.step('Kâşif · telefonda katıl ve kiti aç', async () => {
    await kid.goto('aydinlatma')
    await transferState(studio, kid)
    await joinFromHome(kid, 'Ada')
    await shot(kid, 'k01-bilim-merkezi', 'Bilim Merkezi · Uzay Kâşifleri kiti listede')
    await kid.getByRole('link', { name: new RegExp(UZAY_KIT.title) }).click()
    await expect(kid.getByRole('heading', { level: 1, name: UZAY_KIT.title })).toBeVisible()
    await expect(kid.getByText(`0 / ${UZAY_CARDS.length} kart tamamlandı`)).toBeVisible()
    await shot(kid, 'k02-kit-ana-sayfa', 'Kit ana sayfası · 0 / 10 kart', true)
    await kid.getByRole('link', { name: new RegExp(escape(UZAY_CARDS[0]?.title ?? '')) }).click()
  })

  for (const [index, card] of UZAY_CARDS.entries()) {
    await test.step(`Kâşif · Kart ${index + 1}: ${card.title}`, async () => {
      await expectCard(kid, card)
      if (card.kind === 'choose') await playChoose(kid, card)
      if (card.kind === 'quiz') await playQuiz(kid, card)
      if (card.kind === 'sequence') await playSequence(kid, card)
      if (card.kind === 'matching') await playMatching(kid, card)
      await shot(
        kid,
        `k${10 + index}-kart-${nn(index)}`,
        `Kart ${index + 1} · ${card.title} — çözüldü`,
        true,
      )
      const last = index === UZAY_CARDS.length - 1
      await kid.getByRole('link', { name: last ? /Bitirdim!/ : /Sıradaki kart/ }).click()
    })
  }

  await test.step('Kâşif · tamamlama ekranı ve rozet', async () => {
    await expect(kid.getByRole('heading', { level: 1, name: 'Tebrikler Ada!' })).toBeVisible()
    await expect(kid.getByText(UZAY_KIT.badge.name, { exact: true })).toBeVisible()
    await expect(kid.getByText(UZAY_KIT.badge.description)).toBeVisible()
    await shot(kid, 'k30-tebrikler', 'Tamamlama · Tebrikler Ada! — Uzay Kâşifi rozeti')

    await kid.goto('rozetlerim')
    const badge = kid.getByRole('listitem').filter({ hasText: UZAY_KIT.badge.name })
    await expect(badge).toContainText('tarihinde kazandın')
    await shot(kid, 'k31-rozetlerim', 'Rozetlerim · Uzay Kâşifi kazanıldı')

    await kid.goto(`kit/${UZAY_KIT.slug}`)
    await expect(
      kid.getByText(`${UZAY_CARDS.length} / ${UZAY_CARDS.length} kart tamamlandı`),
    ).toBeVisible()
  })

  await test.step('Kâşif · tek kit QR’ı (UZAY): bitmiş kitte tamamlama ekranı açılır', async () => {
    await kid.goto(`?q=${UZAY_KIT.qrPrefix}`)
    await expect(kid.getByRole('heading', { level: 1, name: 'Tebrikler Ada!' })).toBeVisible()
    await shot(
      kid,
      'k32-qr-kit',
      'QR girişi · UZAY kit QR’ı; tüm kartlar bittiği için rozet ekranı',
    )
  })

  await test.step('Studio · çocuğun etkinliği panoda', async () => {
    await waitForEventsSent(kid)
    await transferState(kid, studio)
    await studio.goto('studio')
    const feed = studio.getByRole('list').filter({ hasText: 'Ada' })
    await expect(feed.first()).toBeVisible()
    await shot(studio, 's40-pano', 'Studio panosu · Ada’nın etkinliği akışta')
    await studio.goto('studio/kasifler')
    await expect(studio.getByRole('link', { name: /Ada/ })).toBeVisible()
  })

  await phone.context.close()

  if (REPORT) {
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(path.join(REPORT_DIR, 'shots.json'), `${JSON.stringify(shots, null, 2)}\n`)
  }
})
