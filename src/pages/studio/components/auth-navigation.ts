import type { SignInResult } from '@/features/auth'
import { safeStudioRedirect } from '@/shared/lib/safe-redirect'

/** Where the auth flow continues after each step (keeps a validated `?donus=`). */
export function nextAuthPath(result: SignInResult, donus: string | null) {
  const target = safeStudioRedirect(donus)
  const query = target !== '/studio' ? `?donus=${encodeURIComponent(target)}` : ''
  switch (result.next) {
    case 'mfa-verify':
    case 'mfa-enroll':
      return `/studio/2fa${query}`
    case 'change-password':
      return `/studio/parola${query}`
    case 'done':
      return target
  }
}
