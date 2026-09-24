import { env } from '@/shared/config/env'

import { NightSkyScene } from './NightSkyScene'

/**
 * Public pre-launch page (VITE_COMING_SOON=true). Always rendered in the dark theme —
 * the night scene is the brand moment — independent of the visitor's OS setting.
 */
export function ComingSoonPage() {
  return (
    <div
      data-theme="dark"
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-night-900 text-fg"
    >
      <title>{`Çalışmalar devam ediyor | ${env.VITE_APP_NAME}`}</title>

      <NightSkyScene className="absolute inset-0 -z-10 size-full" />

      <header className="px-6 pt-6 sm:px-10 sm:pt-8 lg:px-16 lg:pt-10">
        <p className="font-display text-lg font-semibold tracking-tight">{env.VITE_APP_NAME}</p>
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 pt-12 pb-[42vh] sm:px-10 md:pb-[38vh] lg:px-16">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-fg/15 bg-fg/5 px-3.5 py-1.5 text-sm text-fg-muted backdrop-blur-sm">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lamp opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-lamp" />
            </span>
            Yapım aşamasında
          </p>
          <h1 className="mt-6 font-display text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Çalışmalar devam ediyor
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-fg-muted sm:text-xl">
            {env.VITE_APP_NAME}'nin dijital platformunu hazırlıyoruz. Bilimi keşfetmenin yeni adresi
            çok yakında burada.
          </p>
        </div>
      </main>

      <footer className="px-6 pb-6 text-sm text-fg-subtle sm:px-10 lg:px-16 lg:pb-8">
        © {new Date().getFullYear()} {env.VITE_APP_NAME}
      </footer>
    </div>
  )
}
