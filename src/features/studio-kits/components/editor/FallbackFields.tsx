import type { KitIcon, MediaRef } from '@/entities/kit'
import { Input } from '@/shared/ui'

/** Emoji-only icon input used when no page provides the real icon picker. */
export function FallbackIconField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: KitIcon
  onChange: (icon: KitIcon) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={value.kind === 'emoji' ? value.value : ''}
        onChange={(event) => onChange({ kind: 'emoji', value: event.target.value || '✨' })}
      />
    </div>
  )
}

/** Placeholder for media fields when the media library is not composed in. */
export function FallbackMediaField({
  label,
}: {
  id: string
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}) {
  return <p className="text-sm text-fg-muted">{label}: medya kütüphanesi bu görünümde yok.</p>
}
