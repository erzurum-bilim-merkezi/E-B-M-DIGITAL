import { useMemo } from 'react'

import { cn } from '@/shared/lib/cn'

import {
  areaPath,
  CHART_EMPTY_MESSAGE,
  maxOf,
  monotonePath,
  toCount,
  TONE_AREA,
  TONE_BG,
  TONE_STROKE,
} from './chart-utils'
import type { ChartTone } from './types'

export type SparklineProps = {
  values: readonly number[]
  /** Read instead of the drawing, e.g. "Son 14 gün QR okutma: 4'ten 12'ye". */
  ariaLabel: string
  tone?: ChartTone
  emptyMessage?: string
  /** Size it with `h-*` / `w-*` (default 96 × 32 px). */
  className?: string
}

/** Keeps the stroke off the top and bottom edges of the tiny frame. */
const PAD = 10

/** Tiny inline trend for stat tiles and table rows. Zero-based, so flat really means flat. */
export function Sparkline({
  values,
  ariaLabel,
  tone = 1,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: SparklineProps) {
  const geometry = useMemo(() => {
    const counts = values.map(toCount)
    const max = maxOf(counts)
    if (max === 0) return null
    const series = counts.length === 1 ? [counts[0] ?? 0, counts[0] ?? 0] : counts
    const points = series.map((value, index) => ({
      x: (index / (series.length - 1)) * 100,
      y: 100 - PAD - (value / max) * (100 - 2 * PAD),
    }))
    return {
      line: monotonePath(points),
      area: areaPath(points),
      lastY: points[points.length - 1]?.y ?? 100 - PAD,
    }
  }, [values])

  return (
    <span
      className={cn('relative inline-block h-8 w-24 shrink-0 align-middle', className)}
      title={geometry ? undefined : emptyMessage}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {geometry ? (
          <>
            <path d={geometry.area} className={TONE_AREA[tone]} />
            <path
              d={geometry.line}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={TONE_STROKE[tone]}
            />
          </>
        ) : (
          <line
            x1={0}
            x2={100}
            y1={100 - PAD}
            y2={100 - PAD}
            strokeWidth={1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-border-strong"
          />
        )}
      </svg>
      {geometry && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
            TONE_BG[tone],
          )}
          style={{ left: '100%', top: `${geometry.lastY}%` }}
        />
      )}
      <span className="sr-only">{geometry ? ariaLabel : `${ariaLabel}: ${emptyMessage}`}</span>
    </span>
  )
}
