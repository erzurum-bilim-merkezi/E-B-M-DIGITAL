import { Link, Outlet, ScrollRestoration } from 'react-router'

import { env } from '@/shared/config/env'

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-fg focus:shadow-lg focus:outline-2 focus:outline-ring"
      >
        İçeriğe geç
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link to="/" className="text-lg font-semibold text-fg">
            {env.VITE_APP_NAME}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-fg-subtle">
        © {new Date().getFullYear()} {env.VITE_APP_NAME}
      </footer>
      <ScrollRestoration />
    </div>
  )
}
