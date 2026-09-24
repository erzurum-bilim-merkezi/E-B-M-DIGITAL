import { screen } from '@testing-library/react'
import type { RouteObject } from 'react-router'

import { env } from '@/shared/config/env'
import { renderApp } from '@/test/app-harness'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { appRoutes, comingSoonRoutes, resolveRoutes, routes } from './routes'

function Thrower(): never {
  throw new Error('boom')
}

describe('app routes', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  it('are active when coming-soon mode is off', () => {
    expect(env.VITE_COMING_SOON).toBe(false)
    expect(routes).toBe(appRoutes)
  })

  it('sends a new device to the Kâşif welcome flow', async () => {
    const { router } = renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/hosgeldin')
  })

  it('keeps a printed QR target through the welcome flow (?q= → /q/:code)', async () => {
    const { router } = renderApp('/?q=KC-01')

    await screen.findByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' })
    expect(router.state.location.search).toBe(`?donus=${encodeURIComponent('/q/KC-01')}`)
  })

  it('sends signed-out staff to the Studio login with a return path', async () => {
    const { router } = renderApp('/studio/kitler')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Studio’ya giriş' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe(`?donus=${encodeURIComponent('/studio/kitler')}`)
  })

  it('renders the Studio 404 page for unknown Studio paths', async () => {
    signInAs('editor')
    renderApp('/studio/olmayan-sayfa')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sayfa bulunamadı' }),
    ).toBeInTheDocument()
  })

  it('answers 403 on admin-only pages for editors', async () => {
    signInAs('editor')
    renderApp('/studio/kullanicilar')

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu sayfa için yetkiniz yok')
    expect(screen.getByRole('link', { name: 'Panoya dön' })).toHaveAttribute('href', '/studio')
  })

  it('renders the kids route error page when a route throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const kids = appRoutes.find((route) => route.path === '/')
    if (!kids || kids.index) throw new Error('Expected the kids layout route at /')
    const withThrower: RouteObject[] = [
      { ...kids, children: [...(kids.children ?? []), { path: 'boom', Component: Thrower }] },
    ]

    renderApp('/boom', { routes: withThrower })

    expect(await screen.findByRole('alert')).toHaveTextContent('Bir şeyler ters gitti')
    expect(screen.getByRole('link', { name: /Bilim Merkezine dön/ })).toHaveAttribute('href', '/')
  })
})

const paths = (list: RouteObject[]) => list.map((route) => route.path)

describe('resolveRoutes', () => {
  it('serves the full app when coming-soon mode is off', () => {
    expect(resolveRoutes({ comingSoon: false, studioEnabled: false, preview: false })).toBe(
      appRoutes,
    )
  })

  it('hides everything behind coming-soon while the backend is the local mock', () => {
    expect(
      paths(resolveRoutes({ comingSoon: true, studioEnabled: false, preview: false })),
    ).toEqual(['*'])
  })

  it('keeps the Studio reachable behind coming-soon on the live backend', () => {
    expect(paths(resolveRoutes({ comingSoon: true, studioEnabled: true, preview: false }))).toEqual(
      ['/studio', '*'],
    )
  })

  it('opens the Kâşif routes on a preview device', () => {
    expect(paths(resolveRoutes({ comingSoon: true, studioEnabled: true, preview: true }))).toEqual([
      '/studio',
      '/',
    ])
  })
})

describe('coming-soon routes', () => {
  it.each(['/', '/etkinlikler', '/deeply/nested/path'])(
    'render the coming-soon page for %s',
    async (path) => {
      renderApp(path, { routes: comingSoonRoutes })

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Çalışmalar devam ediyor' }),
      ).toBeInTheDocument()
    },
  )
})
