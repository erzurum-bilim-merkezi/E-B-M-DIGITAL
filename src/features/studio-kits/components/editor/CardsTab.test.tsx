import { useState } from 'react'

import {
  BLOCK_CATALOG,
  formatCardCode,
  KUCUK_CIFTCILER,
  MAX_KIT_STEPS,
  validateKitForPublish,
  type KitDocument,
  type Step,
  type StudioKit,
} from '@/entities/kit'
import { toast, Toaster } from '@/shared/ui'
import { seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import { EditorServicesProvider, kitRepository, type EditorServices } from '../../index'
import { CardsTab } from './CardsTab'
import { useKitDraft } from './useKitDraft'

const [TOHUM, MARUL, SERA] = KUCUK_CIFTCILER.steps

function Label({ label }: { label: string }) {
  return <p>{label}</p>
}

/** Stands in for the kit player: shows what it previews and keeps some state to reset. */
function FakePreview({ stepId, device }: { stepId: string | null; device: 'phone' | 'tablet' }) {
  const [taps, setTaps] = useState(0)
  return (
    <button type="button" onClick={() => setTaps((count) => count + 1)}>
      {`Önizleme ${stepId ?? 'yok'} · ${device} · ${taps} dokunuş`}
    </button>
  )
}

const SERVICES: EditorServices = {
  IconField: Label,
  ImageField: Label,
  AudioField: Label,
  CaptionsField: Label,
  assets: new Map(),
  Preview: FakePreview,
  SceneThumb: () => null,
}

function CardsPage({ kit }: { kit: StudioKit }) {
  const controller = useKitDraft(kit)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <CardsTab
      kit={kit}
      controller={controller}
      issues={validateKitForPublish(controller.draft)}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )
}

function renderCards(kit: StudioKit) {
  return renderWithProviders(
    <EditorServicesProvider value={SERVICES}>
      <CardsPage kit={kit} />
      <Toaster />
    </EditorServicesProvider>,
  )
}

function createKit(document: KitDocument = KUCUK_CIFTCILER) {
  return kitRepository.create({
    templateId: 'blank',
    title: document.title,
    slug: document.slug,
    qrPrefix: document.qrPrefix,
    tagline: document.tagline,
    description: document.description,
    category: document.category,
    ageRange: document.ageRange,
    durationMinutes: document.durationMinutes,
    icon: document.icon,
    document,
  })
}

function cardList() {
  return screen.getByRole('list', { name: 'Kartlar' })
}

/** The card list column (add button, inline undo, list, announcements). */
function cardsPanel() {
  return screen.getByRole('complementary', { name: 'Kart listesi' })
}

/** Text of the list's live regions (ours for moves, dnd-kit's for drag and drop). */
function announcements() {
  return within(cardsPanel())
    .getAllByRole('status')
    .map((region) => region.textContent?.trim())
}

/** Sonner's toast region ("Bildirimler alt+T"). */
function notifications() {
  return screen.getByRole('region', { name: /^Bildirimler/ })
}

/** Card titles in list order, read from each card's drag handle ("Tohum nedir? kartını sürükle"). */
function listedTitles() {
  return within(cardList())
    .getAllByRole('button', { name: / kartını sürükle$/ })
    .map((handle) => handle.getAttribute('aria-label')?.replace(/ kartını sürükle$/, ''))
}

/** The select button of the card at 1-based `position` ("1. Tohum nedir?Dokun ve keşfet · KC-01"). */
function cardAt(position: number) {
  return within(cardList()).getByRole('button', { name: new RegExp(`^${position}\\. `) })
}

const titles = (...steps: readonly (Step | undefined)[]) => steps.map((step) => step?.title)

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  // Sonner captures the pointer on toasts (swipe to dismiss); jsdom has no pointer capture.
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  })
})

// Sonner replays still-active toasts to every new <Toaster>; start each test without them.
afterEach(() => {
  toast.dismiss()
})

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('CardsTab', () => {
  it('lists the cards with block type and QR code and edits the first one', async () => {
    const kit = await createKit()
    renderCards(kit)

    expect(listedTitles()).toEqual(titles(...KUCUK_CIFTCILER.steps))
    expect(cardAt(1)).toHaveAccessibleName(
      `1. ${TOHUM!.title}${BLOCK_CATALOG['tap-reveal'].label} · KC-01`,
    )
    expect(cardAt(1)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('textbox', { name: 'Soru / kart başlığı' })).toHaveValue(TOHUM!.title)
  })

  it('opens a card from the list', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(cardAt(2))

    expect(cardAt(2)).toHaveAttribute('aria-current', 'true')
    expect(cardAt(1)).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('textbox', { name: 'Soru / kart başlığı' })).toHaveValue(MARUL!.title)
  })

  it('adds a card of the chosen type with the next QR code', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: 'Kart ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Kart ekle' })
    expect(within(dialog).getAllByRole('button', { name: /E-B-M:/ })).toHaveLength(
      Object.keys(BLOCK_CATALOG).length,
    )
    await user.click(within(dialog).getByRole('button', { name: /^Quiz/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cardAt(8)).toHaveAccessibleName('8. Soru zamanıQuiz · KC-08')
    expect(cardAt(8)).toHaveAttribute('aria-current', 'true')
  })

  it('duplicates a card right after itself with a new QR code', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Çoğalt' }))

    expect(listedTitles().slice(0, 3)).toEqual([
      TOHUM!.title,
      `${TOHUM!.title} (kopya)`,
      MARUL!.title,
    ])
    expect(cardAt(2)).toHaveAccessibleName(/· KC-08$/)
    expect(cardAt(2)).toHaveAttribute('aria-current', 'true')
  })

  it('moves cards with the menu', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    expect(screen.getByRole('menuitem', { name: 'Yukarı taşı' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Aşağı taşı' }))

    expect(listedTitles().slice(0, 2)).toEqual(titles(MARUL, TOHUM))

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Yukarı taşı' }))

    expect(listedTitles().slice(0, 2)).toEqual(titles(TOHUM, MARUL))
  })

  it('moves the focused card with Alt + arrow keys', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)
    cardAt(2).focus()

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(listedTitles().slice(0, 3)).toEqual(titles(TOHUM, SERA, MARUL))

    cardAt(3).focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    // Plain arrows do not move cards.
    await user.keyboard('{ArrowUp}')
    expect(listedTitles().slice(0, 3)).toEqual(titles(TOHUM, MARUL, SERA))
  })

  it('announces keyboard moves and keeps focus on the moved card', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)
    cardAt(2).focus()

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')

    expect(listedTitles().slice(0, 3)).toEqual(titles(TOHUM, SERA, MARUL))
    expect(announcements()).toContain(`“${MARUL!.title}” kartı 3. sıraya taşındı.`)
    expect(cardAt(3)).toHaveFocus()

    // Pressed again, it keeps going (focus did not fall to <body> after the first move).
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(listedTitles()[3]).toBe(MARUL!.title)
    expect(announcements()).toContain(`“${MARUL!.title}” kartı 4. sıraya taşındı.`)
    expect(cardAt(4)).toHaveFocus()

    cardAt(1).focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(announcements()).toContain(`“${TOHUM!.title}” zaten ilk sırada.`)
  })

  it('announces menu moves too', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Aşağı taşı' }))

    expect(announcements()).toContain(`“${TOHUM!.title}” kartı 2. sıraya taşındı.`)
  })

  it('explains and announces drag and drop in Turkish', async () => {
    // dnd-kit scrolls the lifted card into view; jsdom has no scrolling.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })
    const kit = await createKit()
    const { user } = renderCards(kit)
    const handle = within(cardList()).getByRole('button', {
      name: `${TOHUM!.title} kartını sürükle`,
    })

    expect(handle).toHaveAttribute('aria-roledescription', 'sıralanabilir kart')
    expect(handle).toHaveAccessibleDescription(
      /boşluk ya da Enter tuşuna basın.*Vazgeçmek için Escape tuşuna basın\./,
    )

    handle.focus()
    await user.keyboard(' ')
    // Lifted: dnd-kit says where the card is (the start message is followed by its position).
    await waitFor(() => expect(announcements()).toContain(`“${TOHUM!.title}” kartı 1. sırada.`))

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(announcements()).toContain(
        `Taşıma iptal edildi. “${TOHUM!.title}” kartı 1. sırada kaldı.`,
      ),
    )
  })

  it('keeps the last card in place when asked to move it further down', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)
    const last = KUCUK_CIFTCILER.steps.at(-1)!

    cardAt(7).focus()

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(listedTitles().at(-1)).toBe(last.title)
    expect(announcements()).toContain(`“${last.title}” zaten son sırada.`)

    await user.click(screen.getByRole('button', { name: `${last.title} için işlemler` }))
    expect(screen.getByRole('menuitem', { name: 'Aşağı taşı' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('deletes a card, never reuses its QR code and can undo from the toast', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))

    expect(listedTitles()[0]).toBe(MARUL!.title)
    expect(cardAt(1)).toHaveAttribute('aria-current', 'true')
    const toasts = notifications()
    expect(await within(toasts).findByText(`“${TOHUM!.title}” silindi`)).toBeInTheDocument()
    expect(within(toasts).getByText('QR kodu KC-01 bir daha kullanılmayacak.')).toBeInTheDocument()
    // Sonner's controls speak Turkish.
    expect(within(toasts).getByRole('button', { name: 'Kapat' })).toBeInTheDocument()

    await user.click(within(toasts).getByRole('button', { name: 'Geri al' }))

    expect(listedTitles()[0]).toBe(TOHUM!.title)
    expect(cardAt(1)).toHaveAttribute('aria-current', 'true')
    // The inline undo is gone with the toast.
    expect(within(cardsPanel()).queryByRole('button', { name: 'Geri al' })).not.toBeInTheDocument()
  })

  it('keeps the last deletion undoable next to the list, without a time limit', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${MARUL!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))

    // Focus moves to the card that took the deleted one's place, not to <body>.
    await waitFor(() => expect(cardAt(2)).toHaveFocus())
    expect(cardAt(2)).toHaveAccessibleName(new RegExp(`^2\\. ${SERA!.title}`))
    expect(within(cardsPanel()).getByText(`“${MARUL!.title}” silindi.`)).toBeInTheDocument()

    await user.click(within(cardsPanel()).getByRole('button', { name: 'Geri al' }))

    expect(listedTitles().slice(0, 3)).toEqual(titles(TOHUM, MARUL, SERA))
    expect(cardAt(2)).toHaveAttribute('aria-current', 'true')
    await waitFor(() => expect(cardAt(2)).toHaveFocus())
    expect(within(cardsPanel()).queryByText(`“${MARUL!.title}” silindi.`)).not.toBeInTheDocument()
    await waitFor(() =>
      expect(within(notifications()).queryByText(`“${MARUL!.title}” silindi`)).toBeNull(),
    )
  })

  it('lets the deletion notice be dismissed', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))
    await user.click(within(cardsPanel()).getByRole('button', { name: 'Silme bildirimini kapat' }))

    expect(within(cardsPanel()).queryByRole('button', { name: 'Geri al' })).not.toBeInTheDocument()
    expect(listedTitles()[0]).toBe(MARUL!.title)
    await waitFor(() => expect(cardAt(1)).toHaveFocus())
  })

  it('selects the previous card after deleting the last one', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)
    const [last, previous] = KUCUK_CIFTCILER.steps.toReversed()

    await user.click(screen.getByRole('button', { name: `${last!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))

    expect(listedTitles().at(-1)).toBe(previous!.title)
    expect(cardAt(6)).toHaveAttribute('aria-current', 'true')
    await waitFor(() => expect(cardAt(6)).toHaveFocus())
  })

  it('counts publish errors per card', async () => {
    const kit = await createKit({
      ...KUCUK_CIFTCILER,
      steps: [{ ...TOHUM!, title: 'T', answer: '' }, ...KUCUK_CIFTCILER.steps.slice(1)],
    })
    renderCards(kit)

    const [first, second] = within(cardList()).getAllByRole('listitem')
    // The count is visible; screen readers hear "2 sorun" (visually hidden text).
    expect(within(first!).getByText('2 sorun')).toBeInTheDocument()
    expect(within(second!).queryByText(/sorun$/)).not.toBeInTheDocument()
  })

  it('shows the empty state after deleting the only card and focuses "Kart ekle"', async () => {
    const kit = await createKit({ ...KUCUK_CIFTCILER, steps: [TOHUM!] })
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: `${TOHUM!.title} için işlemler` }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))

    expect(screen.getByText('Bu kitte henüz kart yok')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kart ekle' })).toHaveFocus())
  })

  it('invites to add the first card when the kit has none', async () => {
    const kit = await createKit({ ...KUCUK_CIFTCILER, steps: [], qrSequence: 0 })
    renderCards(kit)

    expect(screen.getByText('Bu kitte henüz kart yok')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Kartlar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Önizle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Önizleme yok · phone/ })).toBeInTheDocument()
  })

  it('stops adding cards at 30', async () => {
    const steps = Array.from({ length: 30 }, (_, index) => ({
      ...TOHUM!,
      id: `s-kart-${index + 1}`,
      slug: `kart-${index + 1}`,
      qrCode: formatCardCode('KC', index + 1),
    }))
    const kit = await createKit({ ...KUCUK_CIFTCILER, steps, qrSequence: 30 })

    renderCards(kit)

    expect(screen.getByRole('button', { name: 'Kart ekle' })).toBeDisabled()
  })

  it('undoes a deletion after a new card took the deleted card’s address', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)
    const addQuiz = async () => {
      await user.click(within(cardsPanel()).getByRole('button', { name: 'Kart ekle' }))
      const dialog = await screen.findByRole('dialog', { name: 'Kart ekle' })
      await user.click(within(dialog).getByRole('button', { name: /^Quiz/ }))
    }

    await addQuiz()
    await user.click(screen.getByRole('button', { name: 'Soru zamanı için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))
    await addQuiz()
    await user.click(within(cardsPanel()).getByRole('button', { name: 'Geri al' }))

    expect(listedTitles().slice(-2)).toEqual(['Soru zamanı', 'Soru zamanı'])
    // Autosave succeeds: the restored card got a free address instead of a duplicate one.
    await waitFor(
      async () => {
        const saved = await kitRepository.get(kit.id)
        expect(saved.draft.steps.map((step) => step.slug).slice(-2)).toEqual([
          'soru-zamani-2',
          'soru-zamani',
        ])
      },
      { timeout: 3_000 },
    )
    // Two dialogs and an autosave driven through user-event: slow on busy machines.
  }, 15_000)

  it('explains why a deletion cannot be undone while the kit is full', async () => {
    const steps = Array.from({ length: MAX_KIT_STEPS }, (_, index) => ({
      ...TOHUM!,
      id: `s-kart-${index + 1}`,
      slug: `kart-${index + 1}`,
      title: `Kart ${index + 1}`,
      qrCode: formatCardCode('KC', index + 1),
    }))
    const kit = await createKit({ ...KUCUK_CIFTCILER, steps, qrSequence: MAX_KIT_STEPS })
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: 'Kart 1 için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))
    const undoButton = within(cardsPanel()).getByRole('button', { name: 'Geri al' })
    expect(undoButton).not.toHaveAttribute('aria-disabled')

    await user.click(within(cardsPanel()).getByRole('button', { name: 'Kart ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Kart ekle' })
    await user.click(within(dialog).getByRole('button', { name: /^Quiz/ }))

    expect(undoButton).toHaveAttribute('aria-disabled', 'true')
    expect(undoButton).toHaveAccessibleDescription(
      'Kit 30 kartla dolu; geri almak için önce bir kart silin.',
    )
    undoButton.focus()
    await user.keyboard('{Enter}')

    expect(listedTitles()).toHaveLength(MAX_KIT_STEPS)
    expect(listedTitles()).not.toContain('Kart 1')
    expect(within(cardsPanel()).getByText('“Kart 1” silindi.')).toBeInTheDocument()
    // Renders a full 30-card kit twice over.
  }, 15_000)

  it('previews the selected card on a phone or tablet and resets the preview', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.click(screen.getByRole('button', { name: 'Önizle' }))
    const sheet = await screen.findByRole('dialog', { name: 'Canlı önizleme' })
    const preview = () => within(sheet).getByRole('button', { name: /^Önizleme / })
    expect(preview()).toHaveTextContent(`Önizleme ${TOHUM!.id} · phone · 0 dokunuş`)

    await user.click(within(sheet).getByRole('radio', { name: 'Tablet' }))
    await user.click(preview())
    expect(preview()).toHaveTextContent(`Önizleme ${TOHUM!.id} · tablet · 1 dokunuş`)

    await user.click(within(sheet).getByRole('button', { name: 'Sıfırla' }))
    await waitFor(() => expect(preview()).toHaveTextContent('tablet · 0 dokunuş'))
  })

  it('edits the selected card and saves it with the kit', async () => {
    const kit = await createKit()
    const { user } = renderCards(kit)

    await user.type(screen.getByRole('textbox', { name: 'Soru / kart başlığı' }), '?')
    await user.keyboard('{Control>}s{/Control}')

    expect(listedTitles()[0]).toBe(`${TOHUM!.title}?`)
    await waitFor(async () =>
      expect((await kitRepository.get(kit.id)).draft.steps[0]).toMatchObject({
        title: `${TOHUM!.title}?`,
        slug: 'tohum-nedir',
      }),
    )
  })
})
