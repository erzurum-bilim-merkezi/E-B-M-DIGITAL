import { act, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { Link, type RouteObject } from 'react-router'

import { renderApp } from '@/test/app-harness'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { StudioLayout } from './StudioLayout'

// Whole-layout renders (route tree, providers, mock services).
vi.setConfig({ testTimeout: 20_000 })

function DashboardStub() {
  return (
    <>
      <h1>Pano</h1>
      <Link to="/studio/form">Forma git</Link>
      <Link to="/studio/filtre">Filtreli liste</Link>
      <Link to="/studio/basliksiz">Başlıksız sayfa</Link>
    </>
  )
}

/** A page that puts focus where it wants on arrival (like the kit wizard or the step player). */
function SelfFocusingPage() {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  return (
    <>
      <h1>Form</h1>
      <input ref={input} aria-label="Ad" />
    </>
  )
}

function FilteredList() {
  return (
    <>
      <h1>Liste</h1>
      <Link to="?sayfa=2">Sonraki sayfa</Link>
    </>
  )
}

const studioRoutes: RouteObject[] = [
  {
    path: '/studio',
    Component: StudioLayout,
    children: [
      { index: true, Component: DashboardStub },
      { path: 'form', Component: SelfFocusingPage },
      { path: 'filtre', Component: FilteredList },
      { path: 'basliksiz', Component: () => <p>Henüz başlık yok</p> },
      { path: 'kitler', Component: () => <h1>Kâşif Kitleri</h1> },
    ],
  },
]

function renderStudio(path = '/studio') {
  return renderApp(path, { routes: studioRoutes })
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('StudioLayout', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
    signInAs('admin')
    // The command palette (cmdk) measures and scrolls its list; jsdom does neither.
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  describe('route changes (WCAG 2.4.3, 4.1.3)', () => {
    it('leaves focus alone on the first load', async () => {
      renderStudio()

      await screen.findByRole('heading', { level: 1, name: 'Pano' })

      expect(document.body).toHaveFocus()
    })

    it('moves focus to the new page heading after navigating', async () => {
      const { user } = renderStudio()
      await screen.findByRole('heading', { level: 1, name: 'Pano' })

      await user.click(
        within(screen.getByRole('navigation', { name: 'Studio' })).getByRole('link', {
          name: 'Kâşif Kitleri',
        }),
      )

      const heading = await screen.findByRole('heading', { level: 1, name: 'Kâşif Kitleri' })
      await waitFor(() => expect(heading).toHaveFocus())
      expect(heading).toHaveAttribute('tabindex', '-1')

      // Script-focusable only while focused: Tab order stays as it was.
      await user.tab()
      expect(heading).not.toHaveAttribute('tabindex')
    })

    it('keeps focus where the new page put it', async () => {
      const { user } = renderStudio()

      await user.click(await screen.findByRole('link', { name: 'Forma git' }))

      await screen.findByRole('heading', { level: 1, name: 'Form' })
      expect(screen.getByRole('textbox', { name: 'Ad' })).toHaveFocus()
    })

    it('does not move focus when only the search params change', async () => {
      const { user, router } = renderStudio('/studio/filtre')
      const next = await screen.findByRole('link', { name: 'Sonraki sayfa' })

      await user.click(next)

      await waitFor(() => expect(router.state.location.search).toBe('?sayfa=2'))
      expect(next).toHaveFocus()
    })

    it('focuses the main landmark when the page has no heading yet', async () => {
      const { user } = renderStudio()

      await user.click(await screen.findByRole('link', { name: 'Başlıksız sayfa' }))

      await screen.findByText('Henüz başlık yok')
      await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
    })

    it('focuses the new page, not the menu button, after navigating from the mobile menu', async () => {
      const { user } = renderStudio()
      await user.click(await screen.findByRole('button', { name: 'Menüyü aç' }))
      const sheet = await screen.findByRole('dialog', { name: 'Kâşif Studio' })

      await user.click(within(sheet).getByRole('link', { name: 'Kâşif Kitleri' }))

      const heading = await screen.findByRole('heading', { level: 1, name: 'Kâşif Kitleri' })
      await waitFor(() => expect(heading).toHaveFocus())
      // The sheet's own focus return (deferred) must not take it back.
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(heading).toHaveFocus()
    })
  })

  describe('overlays return focus to their opener (WCAG 2.4.3)', () => {
    it('mobile menu → "Menüyü aç"', async () => {
      const { user } = renderStudio()
      const menuButton = await screen.findByRole('button', { name: 'Menüyü aç' })

      await user.click(menuButton)
      await screen.findByRole('dialog', { name: 'Kâşif Studio' })
      await user.keyboard('{Escape}')

      await waitFor(() => expect(menuButton).toHaveFocus())
    })

    it('command palette opened with the search button → the search button', async () => {
      const { user } = renderStudio()
      const search = await screen.findByRole('button', { name: /^Ara…/ })

      await user.click(search)
      await screen.findByRole('dialog', { name: 'Komut paleti' })
      await user.keyboard('{Escape}')

      await waitFor(() => expect(search).toHaveFocus())
    })

    it('command palette opened with Ctrl + K → where the shortcut was pressed', async () => {
      const { user } = renderStudio()
      const newKit = await screen.findByRole('link', { name: 'Yeni Kâşif Kiti' })
      newKit.focus()

      await user.keyboard('{Control>}k{/Control}')
      await screen.findByRole('dialog', { name: 'Komut paleti' })
      await user.keyboard('{Escape}')

      await waitFor(() => expect(newKit).toHaveFocus())
    })
  })

  it('keeps focused elements clear of the sticky header while mounted (WCAG 2.4.11)', async () => {
    const { unmount } = renderStudio()
    await screen.findByRole('heading', { level: 1, name: 'Pano' })

    expect(document.documentElement.style.scrollPaddingTop).toBe('4.5rem')

    unmount()
    expect(document.documentElement.style.scrollPaddingTop).toBe('')
  })
})

describe('KidsLayout', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  it('treats a redirect while the app starts as the first load', async () => {
    const { router } = renderApp('/')

    await screen.findByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' })

    expect(router.state.location.pathname).toBe('/hosgeldin')
    expect(document.body).toHaveFocus()
  })

  it('moves focus to the new page heading after navigating', async () => {
    const { router } = renderApp('/hosgeldin')
    await screen.findByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' })
    expect(document.body).toHaveFocus()

    await act(() => router.navigate('/aydinlatma'))

    const heading = await screen.findByRole('heading', { level: 1, name: 'Kâşif aydınlatma metni' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('shows the offline notice in the page flow above the content, not over it', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get')
    renderApp('/hosgeldin')
    await screen.findByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' })
    const main = screen.getByRole('main')
    // The status region is there before anything happens, so the change is announced.
    const region = screen
      .getAllByRole('status')
      .find((element) => element.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(region).toBeDefined()
    expect(region).toBeEmptyDOMElement()

    onLine.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(region).toHaveTextContent('İnternet yok — kartlar çalışmaya devam eder')
    expect(region?.closest('.fixed')).toBeNull()

    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(region).toBeEmptyDOMElement()
  })
})
