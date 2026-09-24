import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { appRoutes } from '@/app/router/routes'
import { TooltipProvider } from '@/shared/ui'

import { createTestQueryClient } from './test-utils'

type RenderAppOptions = {
  routes?: RouteObject[]
  queryClient?: QueryClient
}

/**
 * Renders the real route tree (lazy pages, loaders, guards, layouts) at `path` — for page-level
 * integration tests. Seed the mock backend first (see `./mock-backend`).
 */
export function renderApp(
  path: string,
  { routes = appRoutes, queryClient = createTestQueryClient() }: RenderAppOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        {/* Studio layouts mount their own <Toaster />. */}
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...result, router, queryClient, user: userEvent.setup() }
}
