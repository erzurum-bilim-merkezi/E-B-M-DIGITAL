import type { ComponentProps } from 'react'

import { KUCUK_CIFTCILER } from '@/entities/kit'
import { mockMatchMedia } from '@/test/match-media'
import { renderWithProviders, screen, within } from '@/test/test-utils'

import { PlayerProvider } from './PlayerContext'
import { StepShell } from './StepShell'

type Props = ComponentProps<typeof StepShell>

const [FIRST] = KUCUK_CIFTCILER.steps

/** No other card is left to play. */
const WITHOUT_NEXT: Props['nav'] = {
  home: { to: '/kit/kucuk-ciftciler' },
  finish: { to: '/kit/kucuk-ciftciler/tamamlandi' },
  allCards: { to: '/kit/kucuk-ciftciler' },
  scanNext: { to: '/qr-okut' },
}

function renderShell(props: Partial<Props>) {
  if (!FIRST) throw new Error('fixture')
  renderWithProviders(
    <PlayerProvider
      value={{
        reducedMotion: true,
        motion: 'full',
        muted: true,
        celebrate: vi.fn<(message?: string) => void>(),
        mode: 'kids',
      }}
    >
      <StepShell
        kit={KUCUK_CIFTCILER}
        step={FIRST}
        index={0}
        focused={false}
        completed={false}
        onStepComplete={vi.fn<Props['onStepComplete']>()}
        nav={{
          home: { to: '/kit/kucuk-ciftciler' },
          next: { to: '/kit/kucuk-ciftciler/marul-nasil-yetisir' },
          finish: { to: '/kit/kucuk-ciftciler/tamamlandi' },
          allCards: { to: '/kit/kucuk-ciftciler' },
          scanNext: { to: '/qr-okut' },
        }}
        {...props}
      />
    </PlayerProvider>,
  )
  return within(screen.getByRole('navigation', { name: 'Kart gezinmesi' }))
}

function linkNames(nav: ReturnType<typeof renderShell>) {
  return nav.getAllByRole('link').map((link) => link.textContent)
}

beforeEach(() => {
  mockMatchMedia()
  vi.stubGlobal('speechSynthesis', {
    speak: vi.fn<(utterance: unknown) => void>(),
    cancel: vi.fn<() => void>(),
    getVoices: () => [],
    addEventListener: vi.fn<(type: string, listener: unknown) => void>(),
    removeEventListener: vi.fn<(type: string, listener: unknown) => void>(),
  })
})

describe('StepShell · "Her kart kendi QR\'ı ile" (focused)', () => {
  it('shows only the way to the other cards while the card is being played', () => {
    const nav = renderShell({ focused: true, progress: { done: 0, total: 7 } })

    expect(linkNames(nav)).toEqual(['🗂️ Bu kitteki diğer kartlar'])
    expect(screen.queryByRole('link', { name: /Kitin ana sayfası/ })).not.toBeInTheDocument()
  })

  it('asks for the next card’s QR once the card is done', () => {
    const nav = renderShell({ focused: true, completed: true, progress: { done: 3, total: 7 } })

    expect(nav.getByRole('link', { name: /Sıradaki kartın QR'ını okut/ })).toHaveAttribute(
      'href',
      '/qr-okut',
    )
    expect(screen.getByText(/3 \/ 7 kart tamamlandı/)).toBeInTheDocument()
    expect(nav.queryByRole('link', { name: /Sıradaki kart ➜/ })).not.toBeInTheDocument()
  })

  it('offers the badge when the scanned card finishes the kit', () => {
    const nav = renderShell({
      focused: true,
      completed: true,
      kitDone: true,
      progress: { done: 7, total: 7 },
    })

    expect(nav.getByRole('link', { name: /Kiti bitirdin!/ })).toHaveAttribute(
      'href',
      '/kit/kucuk-ciftciler/tamamlandi',
    )
    expect(nav.queryByRole('link', { name: /QR'ını okut/ })).not.toBeInTheDocument()
  })
})

describe('StepShell · "Bir QR yeter, sırayla devam"', () => {
  it('leads on to the next card to play', () => {
    const nav = renderShell({})

    expect(linkNames(nav)).toEqual(['Sıradaki kart ➜'])
  })

  it('finishes the kit when every card is done', () => {
    const nav = renderShell({ completed: true, kitDone: true, nav: WITHOUT_NEXT })

    expect(linkNames(nav)).toEqual(['🏠 Kitin ana sayfası', '🎉 Bitirdim!'])
  })

  it('still offers an unplayed bonus card after the kit is complete', () => {
    const nav = renderShell({ completed: true, kitDone: true })

    expect(linkNames(nav)).toEqual(['Sıradaki kart ➜', '🎉 Bitirdim!'])
  })

  it('points back to the kit when only this card is left', () => {
    const nav = renderShell({ nav: WITHOUT_NEXT })

    expect(linkNames(nav)).toEqual(['🏠 Kitin ana sayfası'])
  })
})
