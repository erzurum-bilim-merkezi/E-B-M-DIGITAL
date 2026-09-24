import { useId, useRef, useState, type FormEvent } from 'react'

import { normalizeQrCode } from '@/entities/kit'
import { cn } from '@/shared/lib/cn'
import { KidButton, KidInput } from '@/shared/ui/kid'

import { formatCodeInput } from '../lib/code-input'

export type CodeEntryProps = {
  /** Receives the normalised code: "kc4" → "KC-04", "kc" → "KC". */
  onSubmit: (code: string) => void
  /** Error from the page (e.g. an unknown code); shown until the child changes the code. */
  error?: string | null
  defaultValue?: string
  className?: string
}

/** Longest printable code: "ABCD-999". */
const MAX_CODE_LENGTH = 8

/**
 * "Kodu yaz": the fallback when a QR cannot be scanned. One big input that formats the code
 * like the label ("kc01" → "KC-01") and an "Aç" button. The visible hint doubles as the
 * instruction; pages provide the heading.
 */
export function CodeEntry({
  onSubmit,
  error = null,
  defaultValue = '',
  className,
}: CodeEntryProps) {
  const id = useId()
  const inputId = `${id}-code`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(() => formatCodeInput(defaultValue))
  /** The value the page's `error` refers to: editing the code hides that error. */
  const [submittedValue, setSubmittedValue] = useState(value)
  const [localError, setLocalError] = useState<string | null>(null)

  const shownError = localError ?? (error && value === submittedValue ? error : null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // "KC-" is the kit code with a dash typed ahead of the number.
    const code = normalizeQrCode(value.replace(/-$/, ''))
    if (!code) {
      setLocalError(
        value
          ? 'Bu kod doğru görünmüyor. Etiketteki kodu kontrol et (ör. KC-01).'
          : 'Önce etiketteki kodu yaz.',
      )
      inputRef.current?.focus()
      return
    }
    setLocalError(null)
    setSubmittedValue(value)
    onSubmit(code)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={cn('flex flex-col gap-3', className)}>
      <label htmlFor={inputId} className="sr-only">
        Kodu yaz
      </label>
      <p id={hintId} className="text-base font-semibold text-kid-fg-soft">
        Etiketin altındaki kodu yaz (ör. KC-01)
      </p>
      <div className="flex flex-wrap gap-3">
        <KidInput
          ref={inputRef}
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(formatCodeInput(event.target.value))
            setLocalError(null)
          }}
          aria-describedby={shownError ? `${hintId} ${errorId}` : hintId}
          aria-invalid={shownError ? true : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={MAX_CODE_LENGTH}
          className="min-w-0 flex-1 basis-40 text-center font-mono tracking-[0.12em]"
        />
        <KidButton type="submit" size="lg" className="min-w-28">
          Aç
        </KidButton>
      </div>
      {shownError && (
        <p
          id={errorId}
          role="alert"
          className="rounded-kid-sm bg-kid-danger-bg px-4 py-3 text-base font-semibold text-kid-danger"
        >
          {shownError}
        </p>
      )}
    </form>
  )
}
