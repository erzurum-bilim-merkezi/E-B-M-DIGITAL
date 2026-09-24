import type { RouteObject } from 'react-router'

import { RootLayout } from '@/app/layouts/RootLayout'
import { env } from '@/shared/config/env'

import { RouteErrorPage } from './RouteErrorPage'

// Pages are lazy-loaded so each route becomes its own chunk.
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        lazy: () => import('@/pages/home/HomePage').then((m) => ({ Component: m.HomePage })),
      },
      {
        path: '*',
        lazy: () =>
          import('@/pages/not-found/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]

// Pre-launch mode: every URL shows the coming-soon page while development continues on main.
export const comingSoonRoutes: RouteObject[] = [
  {
    path: '*',
    errorElement: <RouteErrorPage />,
    lazy: () =>
      import('@/pages/coming-soon/ComingSoonPage').then((m) => ({ Component: m.ComingSoonPage })),
  },
]

export const routes = env.VITE_COMING_SOON ? comingSoonRoutes : appRoutes
