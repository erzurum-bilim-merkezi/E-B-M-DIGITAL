import { useCallback, useEffect, useRef } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'

import {
  DEFAULT_EXPLORER_SETTINGS,
  GLOBAL_BADGES,
  isGlobalBadgeId,
  type EarnedBadge,
} from '@/entities/explorer'
import { useActivitySync } from '@/features/activity'
import { CenterModeGuard, useActiveExplorer } from '@/features/explorer'
import { previewDevice } from '@/shared/config/device-flags'
import { useOnlineStatus } from '@/shared/hooks/browser-hooks'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { stopSpeech } from '@/shared/hooks/useSpeech'
import {
  CelebrationProvider,
  KidThemeProvider,
  Mascot,
  SkyBackdrop,
  useCelebrate,
  useKidTheme,
} from '@/shared/ui/kid'

import { useRouteFocus } from './useRouteFocus'

function ActivityBridge() {
  const celebrate = useCelebrate()
  const onNewBadges = useCallback(
    (badges: EarnedBadge[]) => {
      const global = badges.find((badge) => isGlobalBadgeId(badge.badgeId))
      if (global && isGlobalBadgeId(global.badgeId)) {
        const info = GLOBAL_BADGES[global.badgeId]
        celebrate(`${info.emoji} Yeni rozet: ${info.name}!`)
      }
    },
    [celebrate],
  )
  useActivitySync(onNewBadges)
  return null
}

/**
 * In the page flow above the content, never fixed over it: a floating banner hid the focused
 * control at the bottom of the screen (WCAG 2.4.11). The status region stays mounted so going
 * offline is announced.
 */
function OfflineBanner() {
  const online = useOnlineStatus()
  return (
    <output className="block">
      {!online && (
        <span className="mx-auto mt-[max(0.75rem,env(safe-area-inset-top))] flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-3xl bg-kid-surface px-5 py-2.5 text-base font-semibold text-kid-fg shadow-kid-card">
          <span aria-hidden="true">📡</span> İnternet yok — kartlar çalışmaya devam eder, ilerlemen
          sonra gönderilir.
        </span>
      )}
    </output>
  )
}

function PreviewBadge() {
  const preview = previewDevice.useValue()
  if (!preview) return null
  return (
    <p className="fixed top-2 left-1/2 z-40 -translate-x-1/2 rounded-full bg-kid-sun px-4 py-1 text-sm font-bold text-kid-night shadow-kid-soft">
      Önizleme cihazı · istatistiklere yazılmaz
    </p>
  )
}

function KidsShell() {
  const theme = useKidTheme()
  const { explorer } = useActiveExplorer()
  const osReduced = usePrefersReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const main = useRef<HTMLElement>(null)
  const settings = explorer?.settings ?? DEFAULT_EXPLORER_SETTINGS
  const motion = settings.reduceMotion ? 'minimal' : (theme?.motion ?? 'full')

  useRouteFocus(main)

  // R4: reading stops whenever the page changes.
  // oxlint-disable-next-line react/exhaustive-effect-dependencies -- location.pathname is the trigger: stop speech on every page change
  useEffect(() => stopSpeech(), [location.pathname])

  useEffect(() => {
    document.documentElement.style.fontSize = settings.textSize === 'large' ? '118.75%' : ''
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [settings.textSize])

  return (
    <div
      className="kasif relative isolate min-h-dvh"
      data-kit-theme={theme?.preset}
      data-font={theme?.font}
      data-motion={motion}
      style={theme?.accent ? { '--kit-accent-custom': theme.accent } : undefined}
    >
      <SkyBackdrop />
      <CelebrationProvider reduceMotion={motion === 'minimal' || osReduced}>
        <a
          href="#icerik"
          className="sr-only rounded-full bg-kid-surface px-5 py-3 font-bold text-kid-fg shadow-kid-card focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          İçeriğe geç
        </a>
        <PreviewBadge />
        <OfflineBanner />
        <main
          ref={main}
          id="icerik"
          className="mx-auto flex w-full max-w-5xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <Outlet />
        </main>
        <ActivityBridge />
        <CenterModeGuard onHandOver={() => navigate('/hosgeldin', { replace: true })} />
      </CelebrationProvider>
      <ScrollRestoration />
    </div>
  )
}

export function KidsLayout() {
  return (
    <KidThemeProvider>
      <KidsShell />
    </KidThemeProvider>
  )
}

/** Friendly full-screen loader while the member is being resolved. */
export function KidsSplash({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <output className="grid min-h-[70dvh] place-items-center">
      <span className="flex flex-col items-center gap-3">
        <Mascot
          pose="thinking"
          className="kid-ambient size-28 [animation:kid-float_2.4s_ease-in-out_infinite]"
        />
        <span className="text-xl font-semibold text-kid-fg-soft">{label}</span>
      </span>
    </output>
  )
}

/**
 * Routes that need an active Kâşif member. Without one the child goes to the welcome flow and
 * comes back here afterwards (`?donus=`, internal paths only).
 */
export function RequireExplorer() {
  const { explorer, isPending, activeId } = useActiveExplorer()
  const location = useLocation()
  if (activeId !== null && isPending) return <KidsSplash />
  if (!explorer) {
    const back = `${location.pathname}${location.search}`
    const target = back === '/' ? '/hosgeldin' : `/hosgeldin?donus=${encodeURIComponent(back)}`
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
