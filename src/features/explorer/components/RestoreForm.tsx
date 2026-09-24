import { useRef, useState, type FormEvent } from 'react'

import { normalizeRestoreCode } from '@/entities/explorer'
import { errorMessage, isAppError } from '@/shared/api/errors'
import { KidButton, KidInput } from '@/shared/ui/kid'

import { useRestoreExplorer } from '../api/queries'
import { formatCodeInput } from '../lib/code-input'

export function RestoreForm({
  onRestored,
  initialCode = '',
}: {
  onRestored: (explorerId: string) => void
  initialCode?: string
}) {
  const [code, setCode] = useState(formatCodeInput(initialCode))
  const [problem, setProblem] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restore = useRestoreExplorer()

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!normalizeRestoreCode(code)) {
      setProblem('Kod 8 karakter olmalı (ör. KSF-7Q2M-X9KA).')
      inputRef.current?.focus()
      return
    }
    setProblem(null)
    restore.mutate(code, {
      onSuccess: ({ explorer }) => onRestored(explorer.id),
      onError: (error) => {
        const remaining =
          isAppError(error) && typeof error.details['remaining'] === 'number'
            ? error.details['remaining']
            : null
        setProblem(
          remaining !== null && remaining > 0
            ? `${errorMessage(error)} (${remaining} deneme hakkın kaldı)`
            : errorMessage(error),
        )
        inputRef.current?.focus()
      },
    })
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <label htmlFor="kasif-code" className="text-xl font-bold">
        Kâşif kodun
      </label>
      <KidInput
        ref={inputRef}
        id="kasif-code"
        value={code}
        onChange={(event) => setCode(formatCodeInput(event.target.value))}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        placeholder="KSF-____-____"
        aria-invalid={problem ? true : undefined}
        aria-describedby="kasif-code-hint kasif-code-error"
        className="font-mono tracking-wider uppercase"
      />
      <p id="kasif-code-hint" className="-mt-2 text-base text-kid-fg-soft">
        Kod, Kâşif kartının üzerinde yazar.
      </p>
      <p
        id="kasif-code-error"
        role="alert"
        className="-mt-2 min-h-7 text-lg font-semibold text-kid-danger"
      >
        {problem}
      </p>
      <KidButton type="submit" size="xl" disabled={restore.isPending} aria-busy={restore.isPending}>
        {restore.isPending ? 'Kontrol ediliyor…' : 'Giriş yap ➜'}
      </KidButton>
    </form>
  )
}
