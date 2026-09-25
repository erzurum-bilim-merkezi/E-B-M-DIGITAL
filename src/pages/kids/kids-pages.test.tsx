/* oxlint-disable no-await-in-loop -- a child taps one thing after another */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

import { renderApp } from '@/test/app-harness'
import { mockMatchMedia } from '@/test/match-media'
import { MINIMAL_SEED, seedMockBackend } from '@/test/mock-backend'

// Whole-app renders with seeded data: generous limits so a busy CI machine does not flake.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

/*
 * Page-level integration of the Kâşif app: real routes, guards, layouts, player and mock
 * services (explorer, catalog, activity queue) on a fresh device.
 */

const BLOK_VITRINI_CARDS = [
  'bitkiler-canlidir',
  'dokun-ve-kesfet',
  'evre-kaydirici',
  'kesif-butonlari',
  'ac-kapat',
  'animasyon',
  'dogrulari-sec',
  'karsilastirma',
  'quiz',
  'siralama',
  'eslestirme',
  'deney',
  'video',
]

async function join(user: UserEvent, nickname: string) {
  await user.type(await screen.findByRole('textbox', { name: 'Adın' }), nickname)
  await user.click(screen.getByRole('button', { name: /Devam/ }))
  await user.click(await screen.findByRole('button', { name: /Bilim Merkezine Gir/ }))
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  mockMatchMedia()
  vi.stubGlobal('speechSynthesis', {
    speak: vi.fn<(utterance: unknown) => void>(),
    cancel: vi.fn<() => void>(),
    getVoices: () => [],
    addEventListener: vi.fn<(type: string, listener: unknown) => void>(),
    removeEventListener: vi.fn<(type: string, listener: unknown) => void>(),
  })
})

describe('Kâşif app', () => {
  it('a new device joins, sees its restore code and enters the Science Center', async () => {
    const { user, router } = renderApp('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/hosgeldin'))
    await join(user, 'Deniz')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hoş geldin Deniz!' }),
    ).toBeVisible()
    expect(screen.getByTestId('restore-code')).toHaveTextContent(/^KSF-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    await user.click(screen.getByRole('button', { name: /Bilim Merkezine gir/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Merhaba Deniz!' })).toBeVisible()
    expect(await screen.findByRole('link', { name: /Küçük Çiftçiler/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Blok Vitrini/ })).toBeInTheDocument()
  })

  it('refuses an inappropriate nickname', async () => {
    const { user } = renderApp('/hosgeldin')

    await user.type(await screen.findByRole('textbox', { name: 'Adın' }), 'aptal')
    await user.click(screen.getByRole('button', { name: /Devam/ }))

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.queryByRole('heading', { name: 'Avatarını seç' })).not.toBeInTheDocument()
  })

  it('a printed QR goes through joining straight to its card', async () => {
    const { user, router } = renderApp('/?q=KC-02')

    await join(user, 'Ada')

    expect(
      await screen.findByRole('heading', { level: 1, name: /Marul nasıl yetişir/ }),
    ).toBeVisible()
    expect(router.state.location.search).toBe('?giris=qr')
  })

  it('plays Küçük Çiftçiler to the end and earns the kit badge', async () => {
    const { user } = renderApp('/?q=KC-01')
    await join(user, 'Mert')
    const next = async () =>
      user.click(await screen.findByRole('link', { name: /Bu kitteki diğer kartlar/ }))

    // Focused QR entry: play card 1, then continue from the kit menu.
    await user.click(await screen.findByRole('button', { name: 'Tohuma dokun!' }))
    expect(await screen.findByText(/Filiz çıktı!/)).toBeInTheDocument()
    await next()
    expect(await screen.findByText('1 / 7 kart tamamlandı')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Marul nasıl yetişir/ }))
    const slider = await screen.findByRole('slider', { name: 'Büyüme aşaması' })
    // user-event can't drive range inputs; the keyboard path is covered by the E2E suite.
    fireEvent.change(slider, { target: { value: '3' } })
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringMatching(/Gelişen marul/))
    await user.click(await screen.findByRole('link', { name: /Sıradaki kart/ }))

    for (const name of ['Işık', 'Su', 'Sıcaklık', 'Hava']) {
      await user.click(await screen.findByRole('button', { name }))
    }
    await user.click(screen.getByRole('link', { name: /Sıradaki kart/ }))

    await user.click(await screen.findByRole('button', { name: /Işığı Aç!/ }))
    await user.click(screen.getByRole('link', { name: /Sıradaki kart/ }))

    expect(await screen.findByRole('heading', { level: 1, name: /suya ihtiyaç/ })).toBeVisible()
    await user.click(screen.getByRole('link', { name: /Sıradaki kart/ }))

    await user.click(await screen.findByRole('button', { name: 'Müzik' }))
    await user.click(screen.getByRole('button', { name: 'Su' }))
    await user.click(screen.getByRole('button', { name: 'Sıcaklık' }))
    await user.click(screen.getByRole('link', { name: /Sıradaki kart/ }))

    const compare = await screen.findAllByRole('button', { pressed: false })
    for (const card of compare.filter((button) => /Tohum|Fide/.test(button.textContent ?? ''))) {
      await user.click(card)
    }
    await user.click(screen.getByRole('link', { name: /Bitirdim!/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tebrikler Mert!' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: /Sertifikamı gör/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /Küçük Çiftçiler sertifikası/ }),
    ).toBeInTheDocument()
  })

  it('renders every one of the 13 card types', async () => {
    const { user, router } = renderApp('/')
    await join(user, 'Ela')
    await user.click(await screen.findByRole('button', { name: /Bilim Merkezine gir/ }))
    await screen.findByRole('heading', { level: 1, name: 'Merhaba Ela!' })

    for (const slug of BLOK_VITRINI_CARDS) {
      await router.navigate(`/kit/blok-vitrini/${slug}`)
      expect(await screen.findByRole('navigation', { name: 'Kart gezinmesi' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).not.toBeEmptyDOMElement()
    }
  })

  it('badges, profile settings and the explorer card', async () => {
    const { user, router } = renderApp('/')
    await join(user, 'Can')
    await user.click(await screen.findByRole('button', { name: /Bilim Merkezine gir/ }))
    await screen.findByRole('heading', { level: 1, name: 'Merhaba Can!' })

    await router.navigate('/rozetlerim')
    expect(await screen.findByRole('heading', { level: 1, name: /Rozetlerim/ })).toBeVisible()
    expect(await screen.findByText('İlk QR’ım')).toBeInTheDocument()

    await router.navigate('/profil')
    expect(await screen.findByRole('heading', { level: 1, name: 'Profilim' })).toBeVisible()
    expect(screen.getByText('Kâşif kartı')).toBeInTheDocument()
    const reduceMotion = screen.getByRole('switch', { name: /Animasyonları azalt/ })
    await user.click(reduceMotion)
    expect(reduceMotion).toBeChecked()
  })

  it('opens a card from a typed code and explains unknown codes', async () => {
    const { user, router } = renderApp('/')
    await join(user, 'Ece')
    await user.click(await screen.findByRole('button', { name: /Bilim Merkezine gir/ }))
    await screen.findByRole('heading', { level: 1, name: 'Merhaba Ece!' })

    await router.navigate('/qr-okut')
    await user.type(await screen.findByLabelText('Kodu yaz'), 'kc 3')
    await user.click(screen.getByRole('button', { name: 'Aç' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Sera nedir/ })).toBeVisible()

    await router.navigate('/q/ZZ-09')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bu kart henüz etkin değil' }),
    ).toBeVisible()
  })

  it('rejects a wrong Kâşif code and counts the remaining attempts', async () => {
    const { user } = renderApp('/giris')

    await user.type(await screen.findByLabelText('Kâşif kodun'), 'KSFAAAABBBB')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/deneme hakkın kaldı/)
  })

  it('shows the privacy notice', async () => {
    renderApp('/aydinlatma')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Kâşif aydınlatma metni' }),
    ).toBeVisible()
  })
})
