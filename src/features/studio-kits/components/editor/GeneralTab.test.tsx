import { useState } from 'react'

import {
  KUCUK_CIFTCILER,
  validateKitForPublish,
  type KitDocument,
  type MediaRef,
  type StudioKit,
} from '@/entities/kit'
import { toast, Toaster } from '@/shared/ui'
import { seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import {
  EditorServicesProvider,
  kitRepository,
  publishingService,
  type EditorServices,
} from '../../index'
import { GeneralTab } from './GeneralTab'

const COVER: MediaRef = { assetId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' }

function PickableImageField({
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}) {
  return value ? (
    <button type="button" onClick={() => onChange(undefined)}>{`${label}: kaldır`}</button>
  ) : (
    <button type="button" onClick={() => onChange(COVER)}>{`${label}: seç`}</button>
  )
}

function Harness({
  kit,
  initial,
  beforeRename,
  onDraft,
}: {
  kit: StudioKit
  initial: KitDocument
  beforeRename: () => Promise<void>
  onDraft: (draft: KitDocument) => void
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <GeneralTab
      kit={kit}
      draft={draft}
      issues={validateKitForPublish(draft)}
      update={(mutator) => {
        const next = mutator(draft)
        onDraft(next)
        setDraft(next)
      }}
      beforeRename={beforeRename}
    />
  )
}

function Label({ label }: { label: string }) {
  return <p>{label}</p>
}

const PICKER_SERVICES: EditorServices = {
  IconField: Label,
  ImageField: PickableImageField,
  AudioField: Label,
  CaptionsField: Label,
  assets: new Map(),
  Preview: () => null,
  SceneThumb: () => null,
}

function renderGeneralTab(
  kit: StudioKit,
  { initial = kit.draft, pickImages = false }: { initial?: KitDocument; pickImages?: boolean } = {},
) {
  const drafts: KitDocument[] = []
  const beforeRename = vi.fn<() => Promise<void>>(async () => {})
  const tab = (
    <Harness
      kit={kit}
      initial={initial}
      beforeRename={beforeRename}
      onDraft={(draft) => drafts.push(draft)}
    />
  )
  const view = renderWithProviders(
    <>
      {pickImages ? (
        <EditorServicesProvider value={PICKER_SERVICES}>{tab}</EditorServicesProvider>
      ) : (
        tab
      )}
      <Toaster />
    </>,
  )
  /** The draft as the tab last reported it. */
  const current = () => drafts.at(-1) ?? initial
  return { ...view, current, beforeRename }
}

function createKit(overrides: Partial<KitDocument> = {}) {
  const document = { ...KUCUK_CIFTCILER, ...overrides }
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

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
})

// Sonner replays still-active toasts to every new <Toaster>; start each test without them.
afterEach(() => {
  toast.dismiss()
})

describe('GeneralTab', () => {
  it('edits the title, tagline and description', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)

    await user.type(screen.getByRole('textbox', { name: 'Kit adı' }), '!')
    await user.clear(screen.getByRole('textbox', { name: 'Kısa açıklama' }))
    await user.click(screen.getByRole('textbox', { name: 'Kısa açıklama' }))
    await user.paste('Sera kiti')
    await user.clear(screen.getByRole('textbox', { name: /^Açıklama/ }))
    await user.click(screen.getByRole('textbox', { name: /^Açıklama/ }))
    await user.paste('Yeni metin')

    expect(current()).toMatchObject({
      title: 'Küçük Çiftçiler!',
      tagline: 'Sera kiti',
      description: 'Yeni metin',
    })
  })

  it('flags a title that is too short', async () => {
    const kit = await createKit()
    renderGeneralTab(kit, { initial: { ...kit.draft, title: 'K' } })

    const title = screen.getByRole('textbox', { name: 'Kit adı' })
    expect(title).toBeInvalid()
    expect(title).toHaveAccessibleDescription('Kit adı en az 3 karakter olmalı.')
  })

  it('wraps the selected description text in bold markers', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit, {
      initial: { ...kit.draft, description: 'Tohum büyür' },
    })
    const description = screen.getByRole('textbox', { name: /^Açıklama/ })
    if (!(description instanceof HTMLTextAreaElement)) throw new Error('Expected a textarea')
    // The user has selected "Tohum".
    description.setSelectionRange(0, 5)

    await user.click(screen.getByRole('button', { name: 'Seçili metni kalın yap' }))

    expect(current().description).toBe('**Tohum** büyür')
    await waitFor(() => expect(description).toHaveFocus())
  })

  it('inserts a bold placeholder when nothing is selected', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit, { initial: { ...kit.draft, description: '' } })

    await user.click(screen.getByRole('button', { name: 'Seçili metni kalın yap' }))

    expect(current().description).toBe('**kalın metin**')
  })

  it('sets the category', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Kategori' }), 'Uzay')

    expect(current().category).toBe('space')
  })

  it('keeps the age range ordered while either end changes', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const replace = async (name: string, value: string) => {
      const input = screen.getByRole('spinbutton', { name })
      await user.type(input, value, {
        initialSelectionStart: 0,
        initialSelectionEnd: String(input.getAttribute('value') ?? '').length,
      })
    }

    await replace('En büyük yaş', '7')
    expect(current().ageRange).toEqual({ min: 5, max: 7 })

    await replace('En küçük yaş', '9')
    expect(current().ageRange).toEqual({ min: 9, max: 9 })

    await replace('En büyük yaş', '6')
    expect(current().ageRange).toEqual({ min: 6, max: 6 })
  })

  it('sets the duration in minutes', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const duration = screen.getByRole('spinbutton', { name: 'Süre' })
    expect(duration).toHaveAccessibleDescription(/dakika/)

    await user.type(duration, '45', { initialSelectionStart: 0, initialSelectionEnd: 2 })

    expect(current().durationMinutes).toBe(45)
  })

  it('edits learning objectives', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const objectives = screen.getByRole('group', { name: /^Öğrenme hedefleri/ })

    await user.click(within(objectives).getByRole('button', { name: 'Hedef ekle' }))
    await user.click(within(objectives).getByRole('textbox', { name: 'Öğrenme hedefleri 5' }))
    await user.paste('Serayı tanır.')
    await user.click(within(objectives).getByRole('button', { name: 'Serayı tanır. yukarı taşı' }))
    await user.click(
      within(objectives).getByRole('button', { name: `${kit.draft.learningObjectives[0]} sil` }),
    )

    expect(current().learningObjectives).toEqual([
      KUCUK_CIFTCILER.learningObjectives[1],
      KUCUK_CIFTCILER.learningObjectives[2],
      'Serayı tanır.',
      KUCUK_CIFTCILER.learningObjectives[3],
    ])
  })

  it('adds a material with emoji, name and quantity', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const materials = screen.getByRole('group', { name: /^Malzemeler/ })

    await user.click(within(materials).getByRole('button', { name: 'Malzeme ekle' }))
    const emoji = within(materials).getByRole('textbox', { name: 'Malzeme 6 emoji' })
    await user.clear(emoji)
    await user.type(emoji, '🧤')
    await user.click(within(materials).getByRole('textbox', { name: 'Malzeme 6 adı' }))
    await user.paste('Eldiven')
    await user.click(within(materials).getByRole('textbox', { name: 'Malzeme 6 miktarı' }))
    await user.paste('1 çift')

    expect(current().materials.at(-1)).toMatchObject({
      id: expect.stringMatching(/^m-[a-z0-9]{6}$/),
      emoji: '🧤',
      name: 'Eldiven',
      quantity: '1 çift',
    })
  })

  it('adds a safety note', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const notes = screen.getByRole('group', { name: /^Güvenlik notları/ })

    await user.click(within(notes).getByRole('button', { name: 'Not ekle' }))
    await user.click(within(notes).getByRole('textbox', { name: 'Güvenlik notları 3' }))
    await user.paste('Makası dikkatli kullan.')

    expect(current().safetyNotes.at(-1)).toBe('Makası dikkatli kullan.')
  })

  it('chooses what a QR scan opens', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)

    await user.click(screen.getByRole('radio', { name: /^Bir QR yeter, sırayla devam/ }))
    expect(current().qrEntryMode).toBe('full')

    await user.click(screen.getByRole('radio', { name: /^Her kart kendi QR'ı ile/ }))
    expect(current().qrEntryMode).toBe('focused')
  })

  it('edits the icon with the fallback emoji field when no media library is composed', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit)
    const icon = screen.getByRole('textbox', { name: 'Kit ikonu' })

    await user.clear(icon)
    expect(current().icon).toEqual({ kind: 'emoji', value: '✨' })

    await user.type(icon, '🌻')
    expect(current().icon).toEqual({ kind: 'emoji', value: '✨🌻' })
    expect(
      screen.getByText('Kapak görseli: medya kütüphanesi bu görünümde yok.'),
    ).toBeInTheDocument()
  })

  it('sets and removes the cover through the media library', async () => {
    const kit = await createKit()
    const { user, current } = renderGeneralTab(kit, { pickImages: true })

    await user.click(screen.getByRole('button', { name: 'Kapak görseli: seç' }))
    expect(current().cover).toEqual(COVER)

    await user.click(screen.getByRole('button', { name: 'Kapak görseli: kaldır' }))
    expect(current()).not.toHaveProperty('cover')
  })

  describe('address and QR prefix', () => {
    it('renames a kit that was never published', async () => {
      const kit = await createKit()
      const { user, beforeRename } = renderGeneralTab(kit)
      expect(screen.getByText('Yayından önce değiştirilebilir.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Adresi / öneki değiştir' }))

      expect(beforeRename).toHaveBeenCalled()
      const dialog = await screen.findByRole('dialog', { name: 'Adres ve QR önekini değiştir' })
      const slug = within(dialog).getByRole('textbox', { name: 'Kit adresi' })
      const prefix = within(dialog).getByRole('textbox', { name: 'QR öneki' })
      await user.clear(slug)
      await user.paste('Bahçe Kiti')
      await user.clear(prefix)
      await user.type(prefix, 'bk-1')
      expect(slug).toHaveValue('bahce-kiti')
      expect(slug).toHaveAccessibleDescription('/kit/bahce-kiti')
      expect(prefix).toHaveValue('BK')
      expect(prefix).toHaveAccessibleDescription('Kit QR kodu: BK · kart kodları: BK-01, BK-02 …')

      await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

      expect(await screen.findByText('Adres ve QR öneki güncellendi')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await kitRepository.get(kit.id)).toMatchObject({ slug: 'bahce-kiti', qrPrefix: 'BK' })
    })

    it('does not submit an invalid address or prefix', async () => {
      const kit = await createKit()
      const { user } = renderGeneralTab(kit)
      await user.click(screen.getByRole('button', { name: 'Adresi / öneki değiştir' }))
      const dialog = await screen.findByRole('dialog')
      const slug = within(dialog).getByRole('textbox', { name: 'Kit adresi' })
      const prefix = within(dialog).getByRole('textbox', { name: 'QR öneki' })

      await user.clear(slug)
      await user.clear(prefix)
      await user.type(prefix, 'B')
      await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

      expect(slug).toBeInvalid()
      expect(slug).toHaveAccessibleDescription(/Küçük harf, rakam ve tire/)
      expect(prefix).toHaveAccessibleDescription(/2–4 büyük harf/)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect((await kitRepository.get(kit.id)).slug).toBe('kucuk-ciftciler')
    })

    it('shows why the server refused the new prefix', async () => {
      const kit = await createKit()
      await createKit({ slug: 'mini-sera', qrPrefix: 'MS' })
      const { user } = renderGeneralTab(kit)
      await user.click(screen.getByRole('button', { name: 'Adresi / öneki değiştir' }))
      const dialog = await screen.findByRole('dialog')
      const prefix = within(dialog).getByRole('textbox', { name: 'QR öneki' })

      await user.clear(prefix)
      await user.type(prefix, 'MS')
      await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/QR öneki kullanılmış/)
    })

    it('closes without changes', async () => {
      const kit = await createKit()
      const { user } = renderGeneralTab(kit)
      await user.click(screen.getByRole('button', { name: 'Adresi / öneki değiştir' }))

      await user.click(await screen.findByRole('button', { name: 'Vazgeç' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('is locked after the first publish', async () => {
      const kit = await createKit()
      const { kit: live } = await publishingService.publish(kit.id, {
        notes: '',
        visibility: 'public',
        lockVersion: kit.lockVersion,
        aiReviewConfirmed: false,
      })

      renderGeneralTab(live)

      expect(screen.getByText('İlk yayından sonra kilitlidir.')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Adresi / öneki değiştir' }),
      ).not.toBeInTheDocument()
      expect(screen.getByText('/kit/kucuk-ciftciler')).toBeInTheDocument()
    })
  })
})
