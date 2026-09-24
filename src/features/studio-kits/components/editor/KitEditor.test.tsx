import { useQuery } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { createStore, set } from 'idb-keyval'
import { useState } from 'react'
import { Route, Routes } from 'react-router'

import {
  BLOK_VITRINI,
  KUCUK_CIFTCILER,
  validateKitForPublish,
  type KitDocument,
  type StudioKit,
} from '@/entities/kit'
import { mockControl } from '@/shared/api/mock-db'
import { toast, Toaster } from '@/shared/ui'
import { seedMockBackend, signInAs } from '@/test/mock-backend'
import { act, renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import {
  KitEditor,
  kitQueryOptions,
  kitRepository,
  publishingService,
  type EditorTabId,
} from '../../index'
import { readDraftBackup } from './useKitDraft'

type Role = 'admin' | 'editor'

function EditorPage({
  kitId,
  role,
  onSaveCopy,
}: {
  kitId: string
  role: Role
  onSaveCopy: (draft: KitDocument) => Promise<void>
}) {
  const kit = useQuery(kitQueryOptions(kitId))
  const [tab, setTab] = useState<EditorTabId>('genel')
  const [stepId, setStepId] = useState<string | null>(null)
  if (!kit.data) return <p>Yükleniyor…</p>
  return (
    <KitEditor
      kit={kit.data}
      role={role}
      tab={tab}
      stepId={stepId}
      onNavigate={(next) => {
        if (next.tab) setTab(next.tab)
        if (next.stepId !== undefined) setStepId(next.stepId)
      }}
      onSaveCopy={onSaveCopy}
    />
  )
}

function renderEditor(kit: StudioKit, role: Role = 'admin') {
  const onSaveCopy = vi.fn<(draft: KitDocument) => Promise<void>>(async () => {})
  const view = renderWithProviders(
    <>
      <Routes>
        <Route
          path="/studio/kitler/:kitId"
          element={<EditorPage kitId={kit.id} role={role} onSaveCopy={onSaveCopy} />}
        />
        <Route path="/studio/kitler/:kitId/surumler" element={<h1>Sürüm geçmişi</h1>} />
        <Route path="/studio/kitler/:kitId/onizleme" element={<h1>Kit önizlemesi</h1>} />
      </Routes>
      <Toaster />
    </>,
    { route: `/studio/kitler/${kit.id}` },
  )
  return { ...view, onSaveCopy }
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

function createTemplateKit() {
  return kitRepository.create({
    templateId: 'quiz',
    title: 'Mıknatıs Bilmecesi',
    slug: 'miknatis-bilmecesi',
    qrPrefix: 'MB',
    tagline: '',
    description: '',
    category: 'electricity',
    ageRange: { min: 6, max: 10 },
    durationMinutes: 15,
    icon: { kind: 'emoji', value: '🧲' },
  })
}

/**
 * The editor's first paint (kit query, full General tab, IndexedDB backup check) can outlast
 * Testing Library's 1 s default on a busy worker (coverage, parallel files). Queries that wait
 * for the initial mount use this; they still resolve as soon as the UI is there.
 */
const FIRST_PAINT = { timeout: 4000 }

async function titleField() {
  return screen.findByRole('textbox', { name: 'Kit adı' }, FIRST_PAINT)
}

async function serverTitle(kitId: string) {
  return (await kitRepository.get(kitId)).draft.title
}

/** Dispatches the browser's "leave page" event; true when the page asked to stay. */
function leavePage() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

/** Edits the title while another session saves the kit, then saves: the conflict dialog opens. */
async function conflictingEdit() {
  const kit = await createKit()
  const view = renderEditor(kit)
  await view.user.click(await titleField())
  await view.user.paste(' (benim)')
  await kitRepository.update(kit.id, { ...kit.draft, title: 'Onların adı' }, kit.lockVersion)
  await view.user.keyboard('{Control>}s{/Control}')
  const dialog = await screen.findByRole('dialog', {
    name: 'Bu kit başka bir yerde değiştirildi',
  })
  expect(screen.getByText('Çakışma')).toBeInTheDocument()
  return { ...view, kit, dialog }
}

/** A kit with an IndexedDB backup from an earlier session: three cards and a lower QR counter. */
async function withBackup(title: string) {
  const kit = await createKit()
  await set(
    kit.id,
    {
      draft: { ...kit.draft, title, steps: kit.draft.steps.slice(0, 3), qrSequence: 3 },
      lockVersion: kit.lockVersion,
      savedAt: '2026-09-20T08:30:00.000Z',
    },
    createStore('kasif-drafts', 'drafts'),
  )
  return kit
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
  // Radix menus measure their trigger; jsdom has no ResizeObserver.
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
})

// Sonner replays still-active toasts to every new <Toaster>; start each test without them.
afterEach(() => {
  toast.dismiss()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KitEditor', () => {
  it('shows the kit with its state and links to preview, QR and analytics', async () => {
    const kit = await createKit()
    renderEditor(kit)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Küçük Çiftçiler' }, FIRST_PAINT),
    ).toBeInTheDocument()
    expect(screen.getByText('Taslak')).toBeInTheDocument()
    expect(screen.getByText('Kaydedildi')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kâşif Kitleri' })).toHaveAttribute(
      'href',
      '/studio/kitler',
    )
    for (const [name, path] of [
      ['Önizle', 'onizleme'],
      ['QR oluştur', 'qr'],
      ['Analiz', 'analiz'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        `/studio/kitler/${kit.id}/${path}`,
      )
    }
    expect(screen.getByRole('tab', { name: 'Genel', selected: true })).toBeInTheDocument()
  })

  it('names an untitled kit', async () => {
    const kit = await createKit()
    renderEditor(kit)
    const { user } = { user: userEvent.setup() }

    await user.clear(await titleField())

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Adsız kit')
  })

  describe('saving', () => {
    it('autosaves 800 ms after the last edit', async () => {
      // Only the debounce clock: fake-indexeddb needs the real setImmediate (see useKitDraft.test).
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const kit = await createKit()
      renderEditor(kit)
      const title = await titleField()

      await user.clear(title)
      await user.click(title)
      await user.paste('Minik Çiftçiler')

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Minik Çiftçiler')
      expect(screen.getByText('Kaydedilmemiş değişiklik')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler')

      await act(() => vi.advanceTimersByTimeAsync(800))

      expect(await screen.findByText('Kaydedildi')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Minik Çiftçiler')
    })

    it('saves right away with Ctrl+S and shows the save in progress', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await user.type(await titleField(), '!')
      mockControl.hold('kits.update')

      await user.keyboard('{Control>}s{/Control}')

      expect(screen.getByText('Kaydediliyor…')).toBeInTheDocument()
      mockControl.release('kits.update')
      expect(await screen.findByText('Kaydedildi')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!')
    })

    it('keeps a local backup when saving fails and saves again on retry', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await user.type(await titleField(), '!')
      mockControl.failNext('kits.update', 'unavailable')

      await user.keyboard('{Control>}s{/Control}')

      expect(await screen.findByText('Kaydedilemedi')).toBeInTheDocument()
      await waitFor(async () =>
        expect((await readDraftBackup(kit.id))?.draft.title).toBe('Küçük Çiftçiler!'),
      )

      await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))

      expect(await screen.findByText('Kaydedildi')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!')
      await waitFor(async () => expect(await readDraftBackup(kit.id)).toBeNull())
    })

    it('keeps edits on the device while offline and saves them once back online', async () => {
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await user.type(await titleField(), '!')

      await user.keyboard('{Control>}s{/Control}')

      expect(await screen.findByText('Çevrimdışı — yerelde saklandı')).toBeInTheDocument()
      await waitFor(async () =>
        expect((await readDraftBackup(kit.id))?.draft.title).toBe('Küçük Çiftçiler!'),
      )
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler')

      onLine.mockReturnValue(true)
      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      expect(await screen.findByText('Kaydedildi')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!')
    })

    it('asks before leaving with unsaved changes', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await titleField()
      expect(leavePage()).toBe(false)

      await user.type(await titleField(), '!')

      expect(leavePage()).toBe(true)
    })
  })

  describe('when someone else saved the kit meanwhile', () => {
    it('loads their version', async () => {
      const { user, dialog } = await conflictingEdit()

      await user.click(within(dialog).getByRole('button', { name: 'Son hâlini yükle' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Onların adı')
      expect(screen.getByText('Kaydedildi')).toBeInTheDocument()
    })

    it('overwrites it with mine', async () => {
      const { user, dialog, kit } = await conflictingEdit()

      await user.click(within(dialog).getByRole('button', { name: 'Benimkiyle üzerine yaz' }))

      expect(await screen.findByText('Kaydedildi')).toBeInTheDocument()
      expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler (benim)')
    })

    it('saves mine as a copy, then loads theirs', async () => {
      const { user, dialog, onSaveCopy } = await conflictingEdit()

      await user.click(
        within(dialog).getByRole('button', { name: 'Benimkini kopya olarak kaydet' }),
      )

      expect(onSaveCopy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Küçük Çiftçiler (benim)' }),
      )
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Onların adı'),
      )
    })
  })

  describe('local backups from an earlier session', () => {
    it('restores unsaved local changes on request', async () => {
      const kit = await withBackup('Yerel ad')
      const { user } = renderEditor(kit)
      expect(
        await screen.findByText('Kaydedilmemiş yerel değişiklikler bulundu', {}, FIRST_PAINT),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/bu cihazda sunucuya ulaşmamış değişiklikler var/),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Geri yükle' }))

      expect(screen.queryByText(/Kaydedilmemiş yerel değişiklikler/)).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yerel ad')
      expect(screen.getByText('Kaydedilmemiş değişiklik')).toBeInTheDocument()
      expect(await screen.findByText('Yerel değişiklikler geri yüklendi')).toBeInTheDocument()
      // The kit's identity and never-decreasing QR counter win over the backup.
      await user.keyboard('{Control>}s{/Control}')
      await screen.findByText('Kaydedildi')
      const saved = (await kitRepository.get(kit.id)).draft
      expect(saved).toMatchObject({ title: 'Yerel ad', qrSequence: 7, slug: kit.slug })
      expect(saved.steps).toHaveLength(3)
    })

    it('discards the backup', async () => {
      const kit = await withBackup('Yerel ad')
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('button', { name: 'Sil' }, FIRST_PAINT))

      expect(screen.queryByText(/Kaydedilmemiş yerel değişiklikler/)).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Küçük Çiftçiler')
      await waitFor(async () => expect(await readDraftBackup(kit.id)).toBeNull())
    })

    it('ignores a backup that matches the saved kit', async () => {
      const kit = await createKit()
      await set(
        kit.id,
        { draft: kit.draft, lockVersion: 0, savedAt: '2026-09-20T08:30:00.000Z' },
        createStore('kasif-drafts', 'drafts'),
      )

      renderEditor(kit)
      await titleField()
      await act(async () => {
        await readDraftBackup(kit.id)
      })

      expect(screen.queryByText(/Kaydedilmemiş yerel değişiklikler/)).not.toBeInTheDocument()
    })
  })

  describe('tabs and publish checklist', () => {
    beforeEach(() => {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: vi.fn<Element['scrollIntoView']>(),
      })
    })

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    })

    it('counts blocking issues on each tab and in total on "Yayın"', async () => {
      const kit = await createTemplateKit()
      const errors = validateKitForPublish(kit.draft).filter((issue) => issue.severity === 'error')
      const onCards = errors.filter((issue) => issue.tab === 'kartlar').length
      renderEditor(kit)

      const cards = await screen.findByRole('tab', { name: /^Kartlar/ }, FIRST_PAINT)
      expect(within(cards).getByText(String(onCards))).toBeInTheDocument()
      expect(
        within(screen.getByRole('tab', { name: /^Yayın/ })).getByText(String(errors.length)),
      ).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Genel' })).toHaveTextContent(/^Genel$/)
    })

    it('switches tabs', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('tab', { name: 'Tema' }, FIRST_PAINT))
      expect(screen.getByRole('radiogroup', { name: 'Tema ön ayarı' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Rozet' }))
      expect(screen.getByRole('textbox', { name: 'Rozet adı' })).toHaveValue('Küçük Çiftçi')
    })

    it('jumps from a checklist issue to its card field', async () => {
      const kit = await createTemplateKit()
      const { user } = renderEditor(kit)
      await user.click(await screen.findByRole('tab', { name: /^Yayın/ }, FIRST_PAINT))
      const [firstAnswerIssue] = screen.getAllByRole('button', { name: 'Git: Cevap metni boş.' })

      await user.click(firstAnswerIssue!)

      expect(screen.getByRole('tab', { name: /^Kartlar/, selected: true })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('textbox', { name: /^Cevap/ })).toHaveFocus())
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })

    it('shows the badge issue on the "Rozet" tab', async () => {
      const kit = await createKit({
        ...KUCUK_CIFTCILER,
        badge: { ...KUCUK_CIFTCILER.badge, name: ' ' },
      })
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('tab', { name: /^Rozet/ }, FIRST_PAINT))

      expect(screen.getByRole('alert')).toHaveTextContent('Rozet adı boş.')
    })
  })

  it('tells editors that a kit in review is locked', async () => {
    const kit = await createKit()
    const review = await publishingService.submitForReview(kit.id, kit.lockVersion)
    signInAs('editor')
    const { user } = renderEditor(review, 'editor')

    expect(
      await screen.findByText(/Bu kit incelemede ve editörlere kilitli/, {}, FIRST_PAINT),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Diğer işlemler' }))
    expect(screen.getByRole('menuitem', { name: 'JSON içe aktar' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  describe('"Diğer işlemler" menu', () => {
    it('opens the version history', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('button', { name: 'Diğer işlemler' }, FIRST_PAINT))
      await user.click(screen.getByRole('menuitem', { name: 'Sürümler' }))

      expect(await screen.findByRole('heading', { name: 'Sürüm geçmişi' })).toBeInTheDocument()
    })

    it('exports the working copy as a JSON file', async () => {
      const blobs: Blob[] = []
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
          blobs.push(blob)
          return 'blob:kasif-kiti'
        },
      })
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
      const downloads: string[] = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download)
      })
      const kit = await createKit()
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('button', { name: 'Diğer işlemler' }, FIRST_PAINT))
      await user.click(screen.getByRole('menuitem', { name: 'JSON olarak dışa aktar' }))

      expect(downloads).toEqual(['kucuk-ciftciler-kasif-kiti.json'])
      expect(JSON.parse(await blobs[0]!.text())).toMatchObject({
        id: kit.id,
        title: kit.draft.title,
      })
      Reflect.deleteProperty(URL, 'createObjectURL')
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    })

    it('imports a kit file into the working copy', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await titleField()
      const file = new File([JSON.stringify(BLOK_VITRINI)], 'vitrin.json', {
        type: 'application/json',
      })

      await user.upload(screen.getByLabelText('Kit JSON dosyası'), file)

      expect(await screen.findByText('Kit içe aktarıldı')).toBeInTheDocument()
      expect(screen.getByText(`${BLOK_VITRINI.steps.length} kart yüklendi.`)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(BLOK_VITRINI.title)
      expect(screen.getByText('Kaydedilmemiş değişiklik')).toBeInTheDocument()
    })

    it('explains why a file cannot be imported', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)
      await titleField()

      await user.upload(
        screen.getByLabelText('Kit JSON dosyası'),
        new File(['{ bozuk'], 'bozuk.json', { type: 'application/json' }),
      )

      expect(
        await screen.findByText('Dosya okunamadı: geçerli bir JSON değil.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Küçük Çiftçiler')
    })

    it('lists the keyboard shortcuts', async () => {
      const kit = await createKit()
      const { user } = renderEditor(kit)

      await user.click(await screen.findByRole('button', { name: 'Diğer işlemler' }, FIRST_PAINT))
      await user.click(screen.getByRole('menuitem', { name: 'Klavye kısayolları' }))

      const dialog = screen.getByRole('dialog', { name: 'Klavye kısayolları' })
      expect(
        within(dialog)
          .getAllByRole('term')
          .map((term) => term.textContent),
      ).toEqual(['Kaydet', 'Önizle', 'Komut paleti', 'Kartı taşı', 'Bu pencere'])
    })
  })

  it('opens the card chosen in the "Kartlar" tab', async () => {
    const kit = await createKit()
    const { user } = renderEditor(kit)
    const [, second] = KUCUK_CIFTCILER.steps

    await user.click(await screen.findByRole('tab', { name: /^Kartlar/ }, FIRST_PAINT))
    await user.click(
      within(screen.getByRole('list', { name: 'Kartlar' })).getByRole('button', {
        name: /^2. /,
      }),
    )

    expect(screen.getByRole('textbox', { name: 'Soru / kart başlığı' })).toHaveValue(second!.title)
  })

  it('saves pending edits before the address can be renamed', async () => {
    const kit = await createKit()
    const { user } = renderEditor(kit)
    await user.type(await titleField(), '!')

    await user.click(screen.getByRole('button', { name: 'Adresi / öneki değiştir' }))

    expect(
      await screen.findByRole('dialog', { name: 'Adres ve QR önekini değiştir' }),
    ).toBeInTheDocument()
    expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!')
    expect(screen.getByText('Kaydedildi')).toBeInTheDocument()
  })

  it('opens the shortcuts with "?"', async () => {
    const kit = await createKit()
    const { user } = renderEditor(kit)
    await titleField()

    await user.keyboard('?')

    expect(screen.getByRole('dialog', { name: 'Klavye kısayolları' })).toBeInTheDocument()
  })

  it('saves and opens the preview with Ctrl+Shift+P', async () => {
    const kit = await createKit()
    const { user } = renderEditor(kit)
    await user.type(await titleField(), '!')

    await user.keyboard('{Control>}{Shift>}p{/Shift}{/Control}')

    expect(await screen.findByRole('heading', { name: 'Kit önizlemesi' })).toBeInTheDocument()
    expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!')
  })

  it('saves pending edits when the preview link is followed', async () => {
    const kit = await createKit()
    const { user } = renderEditor(kit)
    await user.type(await titleField(), '!')

    await user.click(screen.getByRole('link', { name: 'Önizle' }))

    expect(await screen.findByRole('heading', { name: 'Kit önizlemesi' })).toBeInTheDocument()
    await waitFor(async () => expect(await serverTitle(kit.id)).toBe('Küçük Çiftçiler!'))
  })
})
