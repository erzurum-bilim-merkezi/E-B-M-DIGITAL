import type { KitIcon as KitIconValue } from '@/entities/kit'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { cn } from '@/shared/lib/cn'

import { LIBRARY_ICON_COMPONENTS } from './library-icons'

function MediaIcon({
  url,
  alt,
  className,
}: {
  url: string | undefined
  alt: string
  className?: string | undefined
}) {
  const resolved = useResolvedMediaUrl(url)
  if (!resolved)
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block size-[1em] rounded-md bg-kid-surface-2', className)}
      />
    )
  return (
    <img
      src={resolved}
      alt={alt}
      className={cn('inline-block size-[1em] rounded-md object-cover', className)}
    />
  )
}

/**
 * Card/kit icon: emoji, bundled science icon or uploaded/AI image. Decorative by default —
 * pass `label` when the icon is the only content of a control.
 */
export function KitIcon({
  icon,
  className,
  label,
}: {
  icon: KitIconValue
  className?: string
  label?: string
}) {
  if (icon.kind === 'emoji') {
    return (
      <span
        className={cn('inline-block leading-none', className)}
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        {icon.value}
      </span>
    )
  }
  if (icon.kind === 'library') {
    const Icon = LIBRARY_ICON_COMPONENTS[icon.id]
    if (label) {
      return (
        <Icon
          className={cn('inline-block size-[1em]', className)}
          strokeWidth={2.2}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline lucide SVG used as the only content of a control; role="img" + aria-label names it
          role="img"
          aria-label={label}
        />
      )
    }
    return (
      <Icon
        className={cn('inline-block size-[1em]', className)}
        strokeWidth={2.2}
        aria-hidden="true"
      />
    )
  }
  return (
    <MediaIcon url={icon.media.url} alt={label ?? icon.media.alt ?? ''} className={className} />
  )
}
