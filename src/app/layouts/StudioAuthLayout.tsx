import { Outlet } from 'react-router'

import { useStudioTheme } from '@/shared/hooks/studio-theme'
import { Mascot } from '@/shared/ui/kid'
import { Toaster } from '@/shared/ui'

/** Split-screen auth layout: night-space brand panel + form (Studio sign-in, 2FA, password). */
export function StudioAuthLayout() {
  const theme = useStudioTheme()
  return (
    <div
      data-theme={theme === 'system' ? undefined : theme}
      className="grid min-h-dvh bg-canvas text-fg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <aside
        data-theme="dark"
        className="relative hidden overflow-hidden bg-[radial-gradient(120%_90%_at_20%_10%,var(--color-brand-700),var(--color-night-950)_60%)] p-12 text-fg lg:flex lg:flex-col lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <Mascot className="size-11" />
          <span className="font-display text-lg font-semibold tracking-tight">Kâşif Studio</span>
        </div>
        <div className="flex flex-col gap-5">
          <Mascot pose="hello" className="size-44" />
          <h2 className="max-w-md font-display text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
            Bilim kitlerini kodsuz tasarla, QR ile çocuklara ulaştır.
          </h2>
          <p className="max-w-md text-fg-muted">
            Kartlar, sahneler, videolar ve yapay zekâ destekli animasyonlar — yayınla, ekipmana QR
            etiketini yapıştır, kâşiflerin keşfini panodan izle.
          </p>
        </div>
        <p className="text-sm text-fg-subtle">Erzurum Bilim Merkezi · Kâşif</p>
      </aside>
      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Mascot className="size-10" />
            <span className="font-display text-lg font-semibold">Kâşif Studio</span>
          </div>
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  )
}
