import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from './providers/AppProviders'
import { routes } from './router/routes'

// Honour Vite's `base` (e.g. /E-B-M-DIGITAL/ on GitHub Pages) for client-side routing.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

const router = createBrowserRouter(routes, { basename })

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
