import { Fragment, useMemo, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import { createQrMatrix, qrSvgPath } from './qr-matrix'

/**
 * Renders content text with the only markup authors get: `**bold**` and line breaks.
 * Always React text nodes — never HTML — so kit content cannot inject markup.
 */
export function RichText({
  text,
  className,
  strongClassName,
}: {
  text: string
  className?: string
  strongClassName?: string
}) {
  const lines = text.split('\n')
  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        // oxlint-disable-next-line react/no-array-index-key -- segments of one string have no identity of their own; they are stateless text, so position is the key
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
            part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
              // oxlint-disable-next-line react/no-array-index-key -- stateless text segment (see above)
              <strong key={partIndex} className={strongClassName}>
                {part.slice(2, -2)}
              </strong>
            ) : (
              // oxlint-disable-next-line react/no-array-index-key -- stateless text segment (see above)
              <Fragment key={partIndex}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </span>
  )
}

export function QrCode({
  value,
  label,
  className,
  quietZone = 4,
  level = 'M',
}: {
  value: string
  /** Accessible name, e.g. "KC-01 kartının QR kodu". */
  label: string
  className?: string
  quietZone?: number
  level?: 'L' | 'M' | 'Q' | 'H'
}) {
  const { path, viewBox } = useMemo(
    () => qrSvgPath(createQrMatrix(value, level), quietZone),
    [value, level, quietZone],
  )
  return (
    <svg
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG drawn from a path; role="img" + aria-label is the accessible pattern for it
      role="img"
      aria-label={label}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      shapeRendering="crispEdges"
      className={cn('block bg-white', className)}
    >
      <rect width={viewBox} height={viewBox} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}
