import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { DemoTotpHint, MfaEnrollForm, MfaVerifyForm, useStaffSession } from '@/features/auth'
import { isMockBackend } from '@/shared/config/backend'

import { nextAuthPath } from './components/auth-navigation'

/** Admin 2FA (aal2): verify an enrolled authenticator or enrol one on first sign-in. */
export function MfaPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = useStaffSession()
  const donus = params.get('donus')

  if (!session)
    return (
      <Navigate to={`/studio/giris${donus ? `?donus=${encodeURIComponent(donus)}` : ''}`} replace />
    )
  if (session.aal === 'aal2')
    return (
      <Navigate
        to={nextAuthPath(
          { next: session.user.mustChangePassword ? 'change-password' : 'done', session },
          donus,
        )}
        replace
      />
    )

  const enrolled = session.user.totpEnrolled
  const onResult = (result: Parameters<typeof nextAuthPath>[0]) =>
    navigate(nextAuthPath(result, donus), { replace: true })

  return (
    <section className="flex flex-col gap-6">
      <title>İki adımlı doğrulama · Kâşif Studio</title>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {enrolled ? 'İki adımlı doğrulama' : 'İki adımlı doğrulamayı kurun'}
        </h1>
        <p className="text-sm text-fg-muted">
          {enrolled
            ? `${session.user.displayName}, kimlik doğrulayıcı uygulamanızdaki kodu girin.`
            : 'Yönetici hesapları için iki adımlı doğrulama zorunludur.'}
        </p>
      </div>
      {enrolled ? <MfaVerifyForm onResult={onResult} /> : <MfaEnrollForm onResult={onResult} />}
      {isMockBackend && enrolled && <DemoTotpHint />}
    </section>
  )
}
