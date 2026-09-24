import { useMutation } from '@tanstack/react-query'
import { Check, KeyRound, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { checkPassword, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH } from '@/entities/studio'
import { errorMessage } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { Alert, Button, Field, Input } from '@/shared/ui'

import { authService, type SignInResult } from '../api'

export function ChangePasswordForm({ onResult }: { onResult: (result: SignInResult) => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const change = useMutation({
    mutationFn: () => authService.changePassword(password),
    onSuccess: onResult,
  })

  const rules = [
    { ok: password.length >= PASSWORD_MIN_LENGTH, label: `En az ${PASSWORD_MIN_LENGTH} karakter` },
    { ok: /[a-zçğıöşü]/i.test(password), label: 'En az bir harf' },
    { ok: /\d/.test(password), label: 'En az bir rakam' },
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = checkPassword(password)
    const next: { password?: string; confirm?: string } = {}
    if (problem) next.password = PASSWORD_MESSAGES[problem]
    if (!problem && password !== confirm) next.confirm = 'Parolalar eşleşmiyor.'
    setErrors(next)
    if (!next.password && !next.confirm) change.mutate()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      {change.isError && <Alert variant="danger">{errorMessage(change.error)}</Alert>}
      <Field label="Yeni parola" error={errors.password} required>
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <ul aria-label="Parola kuralları" className="-mt-2 flex flex-col gap-1 text-xs">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-1.5',
              rule.ok ? 'text-success-fg' : 'text-fg-muted',
            )}
          >
            {rule.ok ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <X aria-hidden="true" className="size-3.5" />
            )}
            {rule.label}
            <span className="sr-only">{rule.ok ? '(sağlandı)' : '(sağlanmadı)'}</span>
          </li>
        ))}
      </ul>
      <Field label="Yeni parola (tekrar)" error={errors.confirm} required>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        loading={change.isPending}
        leadingIcon={<KeyRound aria-hidden="true" />}
      >
        Parolayı kaydet
      </Button>
    </form>
  )
}
