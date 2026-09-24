import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { DemoAccountsHint, LoginForm, useStaffSession } from '@/features/auth'
import { isMockBackend } from '@/shared/config/backend'
import { safeStudioRedirect } from '@/shared/lib/safe-redirect'

import { nextAuthPath } from './components/auth-navigation'

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = useStaffSession()
  const [prefill, setPrefill] = useState({ email: '', password: '' })
  const donus = params.get('donus')

  if (session && session.aal === 'aal2' && !session.user.mustChangePassword) {
    return <Navigate to={safeStudioRedirect(donus)} replace />
  }

  return (
    <section className="flex flex-col gap-6">
      <title>Giriş · Kâşif Studio</title>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Studio’ya giriş</h1>
        <p className="text-sm text-fg-muted">
          Bilim merkezi personeli için. Hesabınızı yöneticiniz oluşturur.
        </p>
      </div>
      <LoginForm
        initialEmail={prefill.email}
        initialPassword={prefill.password}
        onResult={(result) => navigate(nextAuthPath(result, donus), { replace: true })}
      />
      {isMockBackend && <DemoAccountsHint onPick={setPrefill} />}
    </section>
  )
}
