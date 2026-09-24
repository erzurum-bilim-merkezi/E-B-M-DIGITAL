import { useQuery } from '@tanstack/react-query'
import { Route, Routes, useParams } from 'react-router'

import type { StudioKit } from '@/entities/kit'
import { mockControl } from '@/shared/api/mock-db'
import { formatPercent } from '@/shared/lib/format'
import { toast, Toaster } from '@/shared/ui'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import {
  allKitsQueryOptions,
  kitRepository,
  KitStatusBadge,
  KitsTable,
  publishingService,
  type KitRowStats,
} from '../index'

function KitPage({ section }: { section: string }) {
  const { kitId } = useParams()
  return <h1>{`${section}: ${kitId}`}</h1>
}

function KitsPage({ admin, stats }: { admin: boolean; stats?: Record<string, KitRowStats> }) {
  const kits = useQuery(allKitsQueryOptions())
  if (!kits.data) return <p>Yükleniyor…</p>
  return <KitsTable kits={kits.data} admin={admin} stats={stats} />
}

function renderTable({
  admin = true,
  stats,
}: { admin?: boolean; stats?: Record<string, KitRowStats> } = {}) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/studio/kitler" element={<KitsPage admin={admin} stats={stats} />} />
        <Route path="/studio/kitler/:kitId" element={<KitPage section="Düzenle" />} />
        <Route path="/studio/kitler/:kitId/onizleme" element={<KitPage section="Önizleme" />} />
        <Route path="/studio/kitler/:kitId/qr" element={<KitPage section="QR" />} />
        <Route path="/studio/kitler/:kitId/analiz" element={<KitPage section="Analiz" />} />
      </Routes>
      <Toaster />
    </>,
    { route: '/studio/kitler' },
  )
}

async function rowOf(title: string) {
  const link = await screen.findByRole('link', { name: new RegExp(`^${title}`) })
  const row = link.closest('tr')
  if (!row) throw new Error(`No table row for ${title}`)
  return row
}

async function kitBySlug(slug: string) {
  const kit = (await kitRepository.listAll()).find((candidate) => candidate.slug === slug)
  if (!kit) throw new Error(`No kit ${slug}`)
  return kit
}

function createDraft() {
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

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('admin')
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
})

// Sonner replays still-active toasts to every new <Toaster>; start each test without them.
afterEach(() => {
  toast.dismiss()
})

describe('KitsTable', () => {
  it('lists kits with their state, card count and address', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')
    renderTable()

    const row = await rowOf('Küçük Çiftçiler')
    const cells = within(row).getAllByRole('cell')
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/studio/kitler/${kit.id}`)
    expect(within(row).getByRole('link')).toHaveTextContent('KC · /kucuk-ciftciler')
    expect(cells[1]).toHaveTextContent('Yayında')
    expect(cells[2]).toHaveTextContent(String(kit.draft.steps.length))
    expect(cells[3]).toHaveTextContent('az önce')
    expect(screen.getByRole('table', { name: 'Kâşif Kitleri' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'QR (7 gün)' })).not.toBeInTheDocument()
  })

  it('shows 7-day QR scans and completion when statistics are given', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')
    renderTable({ stats: { [kit.id]: { scans7d: 12, completionRate: 0.5, starts: 4 } } })

    expect(await screen.findByRole('columnheader', { name: 'QR (7 gün)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tamamlama' })).toBeInTheDocument()
    const withStats = within(await rowOf('Küçük Çiftçiler')).getAllByRole('cell')
    expect(withStats[3]).toHaveTextContent('12')
    expect(withStats[4]).toHaveTextContent(formatPercent(0.5))
    const without = within(await rowOf('Blok Vitrini')).getAllByRole('cell')
    expect(without[3]).toHaveTextContent('0')
    expect(without[4]).toHaveTextContent('—')
  })

  it('names untitled kits', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')
    const untitled: StudioKit = { ...kit, draft: { ...kit.draft, title: '' } }

    renderWithProviders(<KitsTable kits={[untitled]} admin={false} caption="Son kitler" />)

    expect(screen.getByRole('table', { name: 'Son kitler' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Adsız kit/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adsız kit için işlemler' })).toBeInTheDocument()
  })

  it.each([
    ['Düzenle', 'Düzenle'],
    ['Önizle', 'Önizleme'],
    ['QR oluştur', 'QR'],
    ['Analiz', 'Analiz'],
  ])('opens "%s" from the row menu', async (item, page) => {
    const kit = await kitBySlug('blok-vitrini')
    const { user } = renderTable()

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: item }))

    expect(await screen.findByRole('heading', { name: `${page}: ${kit.id}` })).toBeInTheDocument()
  })

  it('duplicates a kit and opens the copy', async () => {
    const { user } = renderTable({ admin: false })

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Çoğalt' }))

    expect(await screen.findByText('“Blok Vitrini” çoğaltıldı')).toBeInTheDocument()
    const copy = await kitBySlug('blok-vitrini-kopya')
    expect(await screen.findByRole('heading', { name: `Düzenle: ${copy.id}` })).toBeInTheDocument()
  })

  it('offers archive and delete to admins only', async () => {
    signInAs('editor')
    const { user } = renderTable({ admin: false })

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual([
      'Düzenle',
      'Önizle',
      'QR oluştur',
      'Analiz',
      'Çoğalt',
    ])
  })

  it('archives a kit after confirmation', async () => {
    const { user } = renderTable()

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
    expect(screen.queryByRole('menuitem', { name: 'Sil' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Arşivle' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Kiti arşivle' })
    expect(dialog).toHaveAccessibleDescription(/katalogdan kalkar/)
    await user.click(within(dialog).getByRole('button', { name: 'Arşivle' }))

    expect(await screen.findByText('“Blok Vitrini” arşivlendi')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(async () =>
      expect(within(await rowOf('Blok Vitrini')).getAllByRole('cell')[1]).toHaveTextContent(
        'Arşivde',
      ),
    )
  })

  it('keeps a kit when archiving is cancelled', async () => {
    const { user } = renderTable()

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Arşivle' }))
    await user.click(await screen.findByRole('button', { name: 'Vazgeç' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((await kitBySlug('blok-vitrini')).status).toBe('published')
  })

  it('brings an archived kit back', async () => {
    await publishingService.archive((await kitBySlug('blok-vitrini')).id)
    const { user } = renderTable()

    await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Arşivden çıkar' }))

    expect(await screen.findByText('“Blok Vitrini” arşivden çıkarıldı')).toBeInTheDocument()
    expect((await kitBySlug('blok-vitrini')).status).toBe('published')
  })

  it('deletes a never-published kit after confirmation', async () => {
    await createDraft()
    const { user } = renderTable()

    await user.click(
      await screen.findByRole('button', { name: 'Mıknatıs Bilmecesi için işlemler' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Sil' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Kiti sil' })
    expect(dialog).toHaveAccessibleDescription(/basılı QR kodu yok/)
    await user.click(within(dialog).getByRole('button', { name: 'Kalıcı olarak sil' }))

    expect(await screen.findByText('“Mıknatıs Bilmecesi” silindi')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /^Mıknatıs Bilmecesi/ })).not.toBeInTheDocument(),
    )
  })

  describe('when the backend refuses', () => {
    it('reports a failed copy', async () => {
      mockControl.failNext('kits.duplicate', 'unavailable')
      const { user } = renderTable()

      await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
      await user.click(screen.getByRole('menuitem', { name: 'Çoğalt' }))

      expect(await screen.findByText(/Hizmet şu anda yanıt vermiyor/)).toBeInTheDocument()
    })

    it('reports a failed archive and closes the dialog', async () => {
      mockControl.failNext('publishing.archive', 'forbidden')
      const { user } = renderTable()

      await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
      await user.click(screen.getByRole('menuitem', { name: 'Arşivle' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Arşivle' }),
      )

      expect(await screen.findByText('Bu işlem için yetkiniz yok.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    })

    it('reports a failed unarchive', async () => {
      await publishingService.archive((await kitBySlug('blok-vitrini')).id)
      mockControl.failNext('publishing.unarchive', 'unavailable')
      const { user } = renderTable()

      await user.click(await screen.findByRole('button', { name: 'Blok Vitrini için işlemler' }))
      await user.click(screen.getByRole('menuitem', { name: 'Arşivden çıkar' }))

      expect(await screen.findByText(/Hizmet şu anda yanıt vermiyor/)).toBeInTheDocument()
    })

    it('reports a failed delete', async () => {
      await createDraft()
      mockControl.failNext('kits.remove', 'conflict', 'Yayınlanmış kit silinemez.')
      const { user } = renderTable()

      await user.click(
        await screen.findByRole('button', { name: 'Mıknatıs Bilmecesi için işlemler' }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Sil' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Kalıcı olarak sil',
        }),
      )

      expect(await screen.findByText('Yayınlanmış kit silinemez.')).toBeInTheDocument()
    })
  })
})

describe('KitStatusBadge', () => {
  const live: Pick<
    StudioKit,
    'status' | 'publishedVersion' | 'publishedLockVersion' | 'lockVersion'
  > = { status: 'published', publishedVersion: 1, publishedLockVersion: 3, lockVersion: 3 }

  it.each([
    [
      'a new draft',
      { status: 'draft', publishedVersion: null, publishedLockVersion: null },
      'Taslak',
    ],
    [
      'a new kit in review',
      { status: 'in_review', publishedVersion: null, publishedLockVersion: null },
      'İncelemede',
    ],
    ['a live kit', {}, 'Yayında'],
    ['a live kit with edits', { status: 'draft', lockVersion: 4 }, 'Yayında · değişiklik var'],
    ['a live kit in review', { status: 'in_review', lockVersion: 4 }, 'Yayında · incelemede'],
    ['an archived kit', { status: 'archived' }, 'Arşivde'],
  ] as const)('labels %s', async (_, overrides, label) => {
    const kit = await kitBySlug('kucuk-ciftciler')

    renderWithProviders(<KitStatusBadge kit={{ ...kit, ...live, ...overrides }} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
