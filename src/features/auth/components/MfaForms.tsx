import { useMutation } from '@tanstack/react-query'
import { Copy, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { errorMessage } from '@/shared/api/errors'
import { Alert, Button, Field, Input, QrCode, Skeleton, toast } from '@/shared/ui'

import { authService, type SignInResult } from '../api'

function CodeInput({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string | undefined
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <Field
      label="Doğrulama kodu"
      description="Kimlik doğrulayıcı uygulamadaki 6 haneli kod"
      error={error}
      required
    >
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d ]/g, ''))}
        className="h-12 text-center font-mono text-xl tracking-[0.4em] tabular"
        placeholder="000000"
      />
    </Field>
  )
}

export function MfaVerifyForm({ onResult }: { onResult: (result: SignInResult) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const verify = useMutation({
    mutationFn: () => authService.verifyTotp(code),
    onSuccess: onResult,
    onError: (err) => {
      setError(errorMessage(err))
      setCode('')
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kodu girin.')
      return
    }
    setError(undefined)
    verify.mutate()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <CodeInput value={code} onChange={setCode} error={error} />
      <Button
        type="submit"
        size="lg"
        loading={verify.isPending}
        leadingIcon={<ShieldCheck aria-hidden="true" />}
      >
        Doğrula ve devam et
      </Button>
    </form>
  )
}

export function MfaEnrollForm({ onResult }: { onResult: (result: SignInResult) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const enrollment = useMutation({ mutationFn: () => authService.startTotpEnrollment() })
  const confirm = useMutation({
    mutationFn: () => authService.confirmTotpEnrollment(code),
    onSuccess: onResult,
    onError: (err) => {
      setError(errorMessage(err))
      setCode('')
    },
  })

  const { mutate: start } = enrollment
  useEffect(() => start(), [start])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kodu girin.')
      return
    }
    setError(undefined)
    confirm.mutate()
  }

  const secret = enrollment.data?.secret
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg-muted">
        <li>
          Telefonunuza bir kimlik doğrulayıcı uygulama kurun (Google Authenticator, Microsoft
          Authenticator…).
        </li>
        <li>Uygulamada “Hesap ekle”ye dokunup aşağıdaki QR kodu okutun.</li>
        <li>Uygulamanın gösterdiği 6 haneli kodu girin.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-muted p-4 sm:flex-row sm:items-start">
        {enrollment.data ? (
          <QrCode
            value={enrollment.data.uri}
            label="İki adımlı doğrulama QR kodu"
            className="size-40 shrink-0 rounded-md"
          />
        ) : (
          <Skeleton className="size-40 shrink-0" />
        )}
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <p className="text-fg-muted">QR okutamıyorsanız bu anahtarı elle girin:</p>
          {secret ? (
            <div className="flex items-center gap-2">
              <code className="rounded bg-surface px-2 py-1 font-mono text-xs break-all text-fg">
                {secret.match(/.{1,4}/g)?.join(' ')}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Anahtarı kopyala"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(secret)
                    .then(() => toast.success('Anahtar kopyalandı'))
                }}
              >
                <Copy aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Skeleton className="h-6 w-56" />
          )}
        </div>
      </div>
      <Alert variant="warning" title="Kurtarma">
        Telefonunuzu kaybederseniz başka bir yönetici ya da onaylı acil sıfırlama işlemi gerekir. Bu
        yüzden en az iki aktif yönetici bulunmalı.
      </Alert>
      {enrollment.isError && <Alert variant="danger">{errorMessage(enrollment.error)}</Alert>}
      <CodeInput value={code} onChange={setCode} error={error} />
      <Button
        type="submit"
        size="lg"
        loading={confirm.isPending}
        disabled={!secret}
        leadingIcon={<ShieldCheck aria-hidden="true" />}
      >
        Etkinleştir ve devam et
      </Button>
    </form>
  )
}
