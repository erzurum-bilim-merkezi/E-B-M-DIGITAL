import { redirect, type LoaderFunctionArgs } from 'react-router'

import { authService } from '@/features/auth'

function currentPath(request: Request) {
  const url = new URL(request.url)
  return `${url.pathname}${url.search}`
}

/** Strips the router basename so `?donus=` stays an app path. */
function appPath(request: Request) {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
  const path = currentPath(request)
  return base && path.startsWith(base) ? path.slice(base.length) || '/' : path
}

/**
 * Studio guard (F3.6): no session → login with `?donus=`; admins without 2FA → /studio/2fa;
 * temporary passwords → /studio/parola. The server enforces the same rules (RLS/mock policies).
 */
export function requireStaffLoader({ request }: LoaderFunctionArgs) {
  const session = authService.getSession()
  const back = encodeURIComponent(appPath(request))
  if (!session) throw redirect(`/studio/giris?donus=${back}`)
  if (session.user.role === 'admin' && session.aal !== 'aal2')
    throw redirect(`/studio/2fa?donus=${back}`)
  if (session.user.mustChangePassword) throw redirect(`/studio/parola?donus=${back}`)
  return null
}

/** Admin-only pages answer 403 (the route error page explains it). */
export function requireAdminLoader(args: LoaderFunctionArgs) {
  requireStaffLoader(args)
  const session = authService.getSession()
  if (session?.user.role !== 'admin') {
    throw new Response('Bu sayfa yalnızca yöneticilere açık.', {
      status: 403,
      statusText: 'Yetkiniz yok',
    })
  }
  return null
}

/** Printed QR codes point at the site root: `/?q=KC-01` → `/q/KC-01`. */
export function qrQueryLoader({ request }: LoaderFunctionArgs) {
  const code = new URL(request.url).searchParams.get('q')
  if (code) throw redirect(`/q/${encodeURIComponent(code)}`)
  return null
}
