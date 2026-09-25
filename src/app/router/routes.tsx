import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

import { KidsLayout, RequireExplorer } from '@/app/layouts/KidsLayout'
import { isMockBackend } from '@/shared/config/backend'
import { previewDevice } from '@/shared/config/device-flags'
import { env } from '@/shared/config/env'

import { qrQueryLoader, requireAdminLoader, requireStaffLoader } from './guards'
import { RouteErrorPage } from './RouteErrorPage'

const page = <T,>(load: () => Promise<T>, pick: (module: T) => ComponentType) => ({
  lazy: () => load().then((module) => ({ Component: pick(module) })),
})

/** Kâşif (children) — `/` */
const kidsRoutes: RouteObject = {
  path: '/',
  element: <KidsLayout />,
  errorElement: <RouteErrorPage variant="kids" />,
  children: [
    {
      path: 'hosgeldin',
      ...page(
        () => import('@/pages/kids/WelcomePage'),
        (m) => m.WelcomePage,
      ),
    },
    {
      path: 'giris',
      ...page(
        () => import('@/pages/kids/RestorePage'),
        (m) => m.RestorePage,
      ),
    },
    {
      path: 'aydinlatma',
      ...page(
        () => import('@/pages/kids/PrivacyPage'),
        (m) => m.PrivacyPage,
      ),
    },
    {
      element: <RequireExplorer />,
      children: [
        {
          index: true,
          loader: qrQueryLoader,
          ...page(
            () => import('@/pages/kids/ExploreHomePage'),
            (m) => m.ExploreHomePage,
          ),
        },
        {
          path: 'q/:code',
          ...page(
            () => import('@/pages/kids/QrEntryPage'),
            (m) => m.QrEntryPage,
          ),
        },
        {
          path: 'qr-okut',
          ...page(
            () => import('@/pages/kids/QrScanPage'),
            (m) => m.QrScanPage,
          ),
        },
        {
          path: 'kit/:kitSlug',
          ...page(
            () => import('@/pages/kids/KitHomePage'),
            (m) => m.KitHomePage,
          ),
        },
        {
          path: 'kit/:kitSlug/tamamlandi',
          ...page(
            () => import('@/pages/kids/KitCompletePage'),
            (m) => m.KitCompletePage,
          ),
        },
        {
          path: 'kit/:kitSlug/:stepSlug',
          ...page(
            () => import('@/pages/kids/StepPage'),
            (m) => m.StepPage,
          ),
        },
        {
          path: 'sertifika/:kitSlug',
          ...page(
            () => import('@/pages/kids/CertificatePage'),
            (m) => m.CertificatePage,
          ),
        },
        {
          path: 'rozetlerim',
          ...page(
            () => import('@/pages/kids/BadgesPage'),
            (m) => m.BadgesPage,
          ),
        },
        {
          path: 'profil',
          ...page(
            () => import('@/pages/kids/ProfilePage'),
            (m) => m.ProfilePage,
          ),
        },
      ],
    },
    {
      path: '*',
      ...page(
        () => import('@/pages/kids/KidsNotFoundPage'),
        (m) => m.KidsNotFoundPage,
      ),
    },
  ],
}

/** Kâşif Studio (staff) — `/studio` */
const studioRoutes: RouteObject = {
  path: '/studio',
  errorElement: <RouteErrorPage variant="studio" />,
  children: [
    {
      lazy: () =>
        import('@/app/layouts/StudioAuthLayout').then((m) => ({ Component: m.StudioAuthLayout })),
      children: [
        {
          path: 'giris',
          ...page(
            () => import('@/pages/studio/LoginPage'),
            (m) => m.LoginPage,
          ),
        },
        {
          path: '2fa',
          ...page(
            () => import('@/pages/studio/MfaPage'),
            (m) => m.MfaPage,
          ),
        },
        {
          path: 'parola',
          ...page(
            () => import('@/pages/studio/ChangePasswordPage'),
            (m) => m.ChangePasswordPage,
          ),
        },
      ],
    },
    {
      path: 'kitler/:kitId/onizleme',
      loader: requireStaffLoader,
      ...page(
        () => import('@/pages/studio/KitPreviewPage'),
        (m) => m.KitPreviewPage,
      ),
    },
    {
      path: 'kitler/:kitId/qr/yazdir',
      loader: requireStaffLoader,
      ...page(
        () => import('@/pages/studio/KitQrPrintPage'),
        (m) => m.KitQrPrintPage,
      ),
    },
    {
      loader: requireStaffLoader,
      lazy: () => import('@/app/layouts/StudioLayout').then((m) => ({ Component: m.StudioLayout })),
      children: [
        {
          index: true,
          ...page(
            () => import('@/pages/studio/DashboardPage'),
            (m) => m.DashboardPage,
          ),
        },
        {
          path: 'kitler',
          ...page(
            () => import('@/pages/studio/KitListPage'),
            (m) => m.KitListPage,
          ),
        },
        {
          path: 'kitler/yeni',
          ...page(
            () => import('@/pages/studio/KitCreatePage'),
            (m) => m.KitCreatePage,
          ),
        },
        {
          path: 'kitler/:kitId',
          ...page(
            () => import('@/pages/studio/KitEditorPage'),
            (m) => m.KitEditorPage,
          ),
        },
        {
          path: 'kitler/:kitId/surumler',
          ...page(
            () => import('@/pages/studio/KitVersionsPage'),
            (m) => m.KitVersionsPage,
          ),
        },
        {
          path: 'kitler/:kitId/qr',
          ...page(
            () => import('@/pages/studio/KitQrPage'),
            (m) => m.KitQrPage,
          ),
        },
        {
          path: 'kitler/:kitId/analiz',
          ...page(
            () => import('@/pages/studio/KitAnalyticsPage'),
            (m) => m.KitAnalyticsPage,
          ),
        },
        {
          path: 'analitik',
          ...page(
            () => import('@/pages/studio/AnalyticsPage'),
            (m) => m.AnalyticsPage,
          ),
        },
        {
          path: 'medya',
          ...page(
            () => import('@/pages/studio/MediaPage'),
            (m) => m.MediaPage,
          ),
        },
        {
          path: 'ayarlar',
          ...page(
            () => import('@/pages/studio/SettingsPage'),
            (m) => m.SettingsPage,
          ),
        },
        {
          path: 'kasifler',
          loader: requireAdminLoader,
          ...page(
            () => import('@/pages/studio/ExplorersPage'),
            (m) => m.ExplorersPage,
          ),
        },
        {
          path: 'kasifler/:explorerId',
          loader: requireAdminLoader,
          ...page(
            () => import('@/pages/studio/ExplorerDetailPage'),
            (m) => m.ExplorerDetailPage,
          ),
        },
        {
          path: 'kullanicilar',
          loader: requireAdminLoader,
          ...page(
            () => import('@/pages/studio/UsersPage'),
            (m) => m.UsersPage,
          ),
        },
        {
          path: '*',
          ...page(
            () => import('@/pages/studio/StudioNotFoundPage'),
            (m) => m.StudioNotFoundPage,
          ),
        },
      ],
    },
  ],
}

export const appRoutes: RouteObject[] = [studioRoutes, kidsRoutes]

// Pre-launch mode: every URL shows the coming-soon page while development continues on main.
export const comingSoonRoutes: RouteObject[] = [
  {
    path: '*',
    errorElement: <RouteErrorPage />,
    lazy: () =>
      import('@/pages/coming-soon/ComingSoonPage').then((m) => ({ Component: m.ComingSoonPage })),
  },
]

/**
 * Pre-launch (VITE_COMING_SOON): visitors get the coming-soon page. The Studio runs behind it
 * only against the live backend (F12) — a mock Studio demo is never published. A preview device
 * (Studio → Ayarlar, `kasif:preview:v1`) skips coming-soon for the Kâşif routes (F11.7).
 */
export function resolveRoutes({
  comingSoon = env.VITE_COMING_SOON,
  studioEnabled = !isMockBackend,
  preview = previewDevice.get(),
}: { comingSoon?: boolean; studioEnabled?: boolean; preview?: boolean } = {}): RouteObject[] {
  if (!comingSoon) return appRoutes
  const studio = studioEnabled ? [studioRoutes] : []
  return preview ? [...studio, kidsRoutes] : [...studio, ...comingSoonRoutes]
}

export const routes = resolveRoutes()
