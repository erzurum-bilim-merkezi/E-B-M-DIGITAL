import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import { errorMessage } from '@/shared/api/errors'
import { Alert, Button, Field, Input } from '@/shared/ui'

import { authService, type SignInResult } from '../api'

type LoginFormProps = {
  onResult: (result: SignInResult) => void
  /** Pre-fill (demo accounts). */
  initialEmail?: string
  initialPassword?: string
}

export function LoginForm({ onResult, initialEmail = '', initialPassword = '' }: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState(initialPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({})
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const signIn = useMutation({
    mutationFn: () => authService.signIn(email, password),
    onSuccess: onResult,
    onError: () => {
      setPassword('')
      passwordRef.current?.focus()
    },
  })

  // Keep the form in sync when a demo account is picked.
  const [synced, setSynced] = useState({ initialEmail, initialPassword })
  if (synced.initialEmail !== initialEmail || synced.initialPassword !== initialPassword) {
    setSynced({ initialEmail, initialPassword })
    setEmail(initialEmail)
    setPassword(initialPassword)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) errors.email = 'E-posta adresinizi girin.'
    if (!password) errors.password = 'Parolanızı girin.'
    setFieldError(errors)
    if (errors.email) emailRef.current?.focus()
    else if (errors.password) passwordRef.current?.focus()
    else signIn.mutate()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      {signIn.isError && <Alert variant="danger">{errorMessage(signIn.error)}</Alert>}
      <Field label="E-posta" error={fieldError.email} required>
        <Input
          ref={emailRef}
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ad.soyad@kurum.gov.tr"
        />
      </Field>
      <Field label="Parola" error={fieldError.password} required>
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              // A toggle keeps one name; aria-pressed carries the state.
              aria-label="Parolayı göster"
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        )}
      </Field>
      <Button
        type="submit"
        size="lg"
        loading={signIn.isPending}
        leadingIcon={<LogIn aria-hidden="true" />}
      >
        Giriş yap
      </Button>
    </form>
  )
}
