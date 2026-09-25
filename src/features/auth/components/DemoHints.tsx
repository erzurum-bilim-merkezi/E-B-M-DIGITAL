import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'

import { totpCode } from '@/shared/lib/totp'
import { Button } from '@/shared/ui'

import { DEMO_ACCOUNTS, DEMO_TOTP_SECRET } from '../api/demo-accounts'

type DemoAccount = { email: string; password: string; label: string }

const ACCOUNTS: DemoAccount[] = [
  { label: 'Yönetici', email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password },
  { label: 'Editör', email: DEMO_ACCOUNTS.editor.email, password: DEMO_ACCOUNTS.editor.password },
]

/** Local demo only: the mock backend's accounts, so anyone can try Studio in this browser. */
export function DemoAccountsHint({
  onPick,
}: {
  onPick: (account: { email: string; password: string }) => void
}) {
  return (
    <aside
      aria-label="Deneme hesapları"
      className="rounded-lg border border-dashed border-border-strong bg-surface-muted/60 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-medium text-fg">
        <FlaskConical aria-hidden="true" className="size-4 text-primary" /> Deneme ortamı
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        Veriler yalnızca bu tarayıcıda tutulur. Bir hesap seçip giriş yapabilirsiniz.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {ACCOUNTS.map((account) => (
          <li key={account.email} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="font-medium text-fg">{account.label}</span>{' '}
              <span className="font-mono text-xs break-all text-fg-muted">{account.email}</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => onPick(account)}>
              {account.label} ile doldur
            </Button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** Local demo only: the demo admins' current authenticator code with a countdown. */
export function DemoTotpHint() {
  const [state, setState] = useState<{ code: string; remaining: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const now = Date.now()
      const code = await totpCode(DEMO_TOTP_SECRET, now)
      if (!cancelled) setState({ code, remaining: 30 - Math.floor((now / 1000) % 30) })
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <aside
      aria-label="Deneme doğrulama kodu"
      className="rounded-lg border border-dashed border-border-strong bg-surface-muted/60 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-medium text-fg">
        <FlaskConical aria-hidden="true" className="size-4 text-primary" /> Deneme ortamı
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        Deneme yöneticilerinin kimlik doğrulayıcı kodu (her 30 saniyede yenilenir):
      </p>
      <p
        className="mt-2 font-mono text-2xl font-semibold tracking-[0.3em] text-fg tabular"
        data-testid="demo-totp"
      >
        {state ? `${state.code.slice(0, 3)} ${state.code.slice(3)}` : '··· ···'}
      </p>
      {state && <p className="text-xs text-fg-subtle tabular">{state.remaining} sn kaldı</p>}
    </aside>
  )
}
