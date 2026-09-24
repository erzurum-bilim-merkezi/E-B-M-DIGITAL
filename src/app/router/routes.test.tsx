import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { env } from '@/shared/config/env'
import { createTestQueryClient } from '@/test/test-utils'

import { appRoutes, comingSoonRoutes, routes } from './routes'

function renderRoute(path: string, routeConfig: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] })
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function Thrower(): never {
  throw new Error('boom')
}

describe('app routes', () => {
  it('are active when coming-soon mode is off', () => {
    expect(env.VITE_COMING_SOON).toBe(false)
    expect(routes).toBe(appRoutes)
  })

  it('renders the home page inside the root layout', async () => {
    renderRoute('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: env.VITE_APP_NAME }),
    ).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(await screen.findByText(/API: Çalışıyor/)).toBeInTheDocument()
  })

  it('renders the 404 page for unknown paths', async () => {
    renderRoute('/does-not-exist')

    expect(await screen.findByRole('heading', { name: 'Sayfa bulunamadı' })).toBeInTheDocument()
  })

  it('renders the route error page when a route throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const [root] = appRoutes
    if (!root || root.index) throw new Error('Expected a layout route at the root')
    const withThrower: RouteObject[] = [
      { ...root, children: [...(root.children ?? []), { path: 'boom', Component: Thrower }] },
    ]

    renderRoute('/boom', withThrower)

    expect(await screen.findByRole('alert')).toHaveTextContent('Sayfa yüklenemedi')
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/')
  })
})

describe('coming-soon routes', () => {
  it.each(['/', '/etkinlikler', '/deeply/nested/path'])(
    'render the coming-soon page for %s',
    async (path) => {
      renderRoute(path, comingSoonRoutes)

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Çalışmalar devam ediyor' }),
      ).toBeInTheDocument()
    },
  )
})
