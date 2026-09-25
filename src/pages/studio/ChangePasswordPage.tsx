import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { ChangePasswordForm, useStaffSession } from '@/features/auth'

import { nextAuthPath } from './components/auth-navigation'

/** First sign-in with a temporary password: choosing a new one is mandatory. */
export function ChangePasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = useStaffSession()
  const donus = params.get('donus')

  if (!session) return <Navigate to="/studio/giris" replace />

  return (
    <section className="flex flex-col gap-6">
      <title>Parola belirle · Kâşif Studio</title>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Yeni parolanızı belirleyin
        </h1>
        <p className="text-sm text-fg-muted">
          {session.user.mustChangePassword
            ? 'Geçici parolayla giriş yaptınız. Devam etmek için kendi parolanızı belirleyin.'
            : 'Hesabınız için yeni bir parola seçin.'}
        </p>
      </div>
      <ChangePasswordForm
        onResult={(result) => navigate(nextAuthPath(result, donus), { replace: true })}
      />
    </section>
  )
}
