import { useState, type KeyboardEvent } from 'react'

import { Field, Input } from '@/shared/ui'

/**
 * A number typed freely and kept within bounds once the field is left: clamping on every key made
 * "10" impossible (the "1" became the minimum). Enter keeps the value and never submits the form
 * around the AI panels (the kit wizard's).
 */
export function BoundedNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const commit = () => {
    const parsed = Number.parseInt(text, 10)
    const next = Number.isNaN(parsed) ? value : Math.max(min, Math.min(max, parsed))
    setText(String(next))
    if (next !== value) onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit()
  }
  return (
    <Field label={label}>
      <Input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
