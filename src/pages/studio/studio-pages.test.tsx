/* oxlint-disable no-await-in-loop -- tabs are visited one after another */
import { screen, waitFor, within } from '@testing-library/react'

import { renderApp } from '@/test/app-harness'
import { mockMatchMedia } from '@/test/match-media'
import { seedMockBackend, signInAs } from '@/test/mock-backend'

// Whole-app renders with seeded data: generous limits so a busy CI machine does not flake.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

/*
 * Page-level integration: the real route tree, guards, layouts and mock services with the demo
 * seed (4 kits, 24 explorers, a month of activity) — every Studio page renders its real data.
 */

async function kitIdOf(title: string) {
  const { kitRepository } = await import('@/features/studio-kits')
  const kits = await kitRepository.listAll()
  const kit = kits.find((candidate) => candidate.draft.title === title)
  if (!kit) throw new Error(`kit ${title} not seeded`)
  return kit.id
}

beforeAll(async () => {
  await seedMockBackend()
})

beforeEach(() => {
  mockMatchMedia()
  signInAs('admin')
})

describe('Studio pages (admin, demo data)', () => {
  it('dashboard: KPIs, review queue, live feed and quotas', async () => {
    renderApp('/studio')

    expect(await screen.findByRole('heading', { level: 1, name: /Merhaba Deniz/ })).toBeVisible()
    expect(await screen.findByText('Bugün aktif kâşif')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'İncelemeni bekleyenler' })).toBeInTheDocument()
    expect((await screen.findAllByText('Su Damlasının Yolculuğu')).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Canlı etkinlik' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kotalar' })).toBeInTheDocument()
  })

  it('kit list: filters by status through the URL', async () => {
    const { user, router } = renderApp('/studio/kitler')

    expect(await screen.findByRole('link', { name: /Küçük Çiftçiler/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durum' }), 'draft')

    await waitFor(() => expect(router.state.location.search).toContain('durum=draft'))
    expect(await screen.findByRole('link', { name: /Mıknatıs Bilmecesi/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Küçük Çiftçiler/ })).not.toBeInTheDocument(),
    )
  })

  it('new kit wizard: template → name → details', async () => {
    const { user } = renderApp('/studio/kitler/yeni')

    expect(await screen.findByRole('heading', { level: 1, name: 'Yeni Kâşif Kiti' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: /Boş kit/ }))
    await user.click(screen.getByRole('button', { name: /Devam/ }))
    await user.type(await screen.findByRole('textbox', { name: /Kit adı/ }), 'Ses Dalgaları')
    await user.click(screen.getByRole('button', { name: /Devam/ }))
    expect(await screen.findByRole('button', { name: 'Oluştur ve kartları ekle' })).toBeVisible()
  })

  it('kit editor: every tab of a published kit', async () => {
    const id = await kitIdOf('Küçük Çiftçiler')
    const { user } = renderApp(`/studio/kitler/${id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Küçük Çiftçiler' })).toBeVisible()
    for (const tab of [/Kartlar/, /Tema/, /Rozet/, /Yayın/, /Genel/]) {
      await user.click(screen.getByRole('tab', { name: tab }))
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true'),
      )
    }
  })

  it('versions, QR codes, print sheets and kit analytics', async () => {
    const id = await kitIdOf('Küçük Çiftçiler')

    const versions = renderApp(`/studio/kitler/${id}/surumler`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sürümler' })).toBeVisible()
    expect(await screen.findByText('Canlı')).toBeInTheDocument()
    versions.unmount()

    const qr = renderApp(`/studio/kitler/${id}/qr`)
    expect(await screen.findByRole('heading', { level: 1, name: 'QR kodları' })).toBeVisible()
    // 8 codes (kit + 7 cards) plus the kit's own status badge.
    expect((await screen.findAllByText('Yayında')).length).toBeGreaterThanOrEqual(8)
    qr.unmount()

    const print = renderApp(`/studio/kitler/${id}/qr/yazdir?sablon=kutu`)
    expect(await screen.findByRole('heading', { level: 1, name: /QR yazdır/ })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Kit kutusu' })).toBeChecked()
    print.unmount()

    renderApp(`/studio/kitler/${id}/analiz?aralik=90`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Kit analizi' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Kart hunisi' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '90 gün' })).toBeChecked()
  })

  it('analytics overview with a period switch', async () => {
    const { user, router } = renderApp('/studio/analitik')

    expect(await screen.findByRole('heading', { level: 1, name: 'Analitik' })).toBeVisible()
    expect(await screen.findByText('Tekil kâşif')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '7 gün' }))
    await waitFor(() => expect(router.state.location.search).toBe('?aralik=7'))
    expect(screen.getByRole('button', { name: 'CSV indir' })).toBeEnabled()
  })

  it('explorers list, filters and an explorer’s detail', async () => {
    const { user, router } = renderApp('/studio/kasifler')

    const table = await screen.findByRole('table', { name: 'Kâşifler' })
    const first = within(table).getAllByRole('link')[0]!
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tamamlama' }), 'hayir')
    await waitFor(() => expect(router.state.location.search).toContain('tamamladi=hayir'))

    await user.click(first)
    expect(await screen.findByRole('button', { name: 'Verileri indir (JSON)' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Etkinlik zaman çizelgesi' })).toBeInTheDocument()
  })

  it('media, users and settings', async () => {
    const media = renderApp('/studio/medya')
    expect(await screen.findByRole('heading', { level: 1, name: 'Medya' })).toBeVisible()
    media.unmount()

    const users = renderApp('/studio/kullanicilar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Kullanıcılar' })).toBeVisible()
    expect(await screen.findByText('Elif Demir')).toBeInTheDocument()
    users.unmount()

    renderApp('/studio/ayarlar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayarlar' })).toBeVisible()
    expect(await screen.findByRole('table', { name: 'Denetim kaydı' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Kâşif’i önizle/ })).not.toBeChecked()
  })

  it('creates a centre device and shows its setup code once', async () => {
    const { user } = renderApp('/studio/ayarlar')

    await user.type(await screen.findByRole('textbox', { name: 'Cihaz adı' }), 'Tablet 3')
    await user.type(screen.getByLabelText('Eğitmen PIN’i (4–8 rakam)'), '1357')
    await user.click(screen.getByRole('button', { name: 'Kurulum kodu üret' }))

    const dialog = await screen.findByRole('dialog', { name: 'Kurulum kodu' })
    expect(within(dialog).getByTestId('center-setup-code')).not.toBeEmptyDOMElement()
    await user.click(within(dialog).getByRole('button', { name: 'Tamam' }))
    expect(await screen.findByRole('cell', { name: 'Tablet 3' })).toBeInTheDocument()
  })

  it('kit preview renders the player without the Studio chrome', async () => {
    const id = await kitIdOf('Blok Vitrini')
    renderApp(`/studio/kitler/${id}/onizleme`)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Önizleme: Blok Vitrini/ }),
    ).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Studio' })).not.toBeInTheDocument()
  })

  it('unknown Studio paths show the Studio 404', async () => {
    renderApp('/studio/bilinmeyen')

    expect(await screen.findByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeVisible()
  })
})

describe('Studio for editors', () => {
  beforeEach(() => signInAs('editor'))

  it('hides admin-only navigation and explorer identities', async () => {
    renderApp('/studio')

    const nav = await screen.findByRole('navigation', { name: 'Studio' })
    expect(within(nav).queryByRole('link', { name: 'Kullanıcılar' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Kâşifler' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Canlı etkinlik' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /#[0-9A-Z]{4}/ })).not.toBeInTheDocument()
  })

  it('password page asks for the current password on a voluntary change', async () => {
    renderApp('/studio/parola')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Yeni parolanızı belirleyin' }),
    ).toBeVisible()
    expect(screen.getByLabelText(/Mevcut parola/)).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })

  it('cannot export analytics CSV (admin only)', async () => {
    renderApp('/studio/analitik')

    expect(await screen.findByRole('heading', { level: 1, name: 'Analitik' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'CSV indir' })).not.toBeInTheDocument()
  })
})
