import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'
import { cn } from '@/shared/lib/cn'

/** Uploaded image (https or mock blob store) with its required alt text. */
export function MediaImage({
  url,
  alt,
  className,
}: {
  url: string | undefined
  alt: string
  className?: string
}) {
  const resolved = useResolvedMediaUrl(url)
  if (resolved === undefined) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'aspect-[4/3] w-full animate-pulse rounded-[1.25rem] bg-kid-surface-2',
          className,
        )}
      />
    )
  }
  if (resolved === null) {
    return (
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- placeholder tile for an image that failed to load; there is no src for a native <img>, but the author alt text must still be announced
        role="img"
        aria-label={alt || 'Görsel'}
        className={cn(
          'grid aspect-[4/3] w-full place-items-center rounded-[1.25rem] bg-kid-surface-2 text-5xl',
          className,
        )}
      >
        <span aria-hidden="true">🖼️</span>
      </div>
    )
  }
  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('block h-auto w-full rounded-[1.25rem] object-cover', className)}
    />
  )
}
