import { useMemo, useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatNumber, formatPercent } from '@/shared/lib/format'

import { ChartEmptyState } from './ChartEmptyState'
import { ChartLegend } from './ChartLegend'
import { ChartTooltip } from './ChartTooltip'
import { CHART_EMPTY_MESSAGE, maxOf, sumOf, toCount, TONE_BG, withKeys } from './chart-utils'
import type { StackedBarsLegendItem, StackedBarsRow } from './types'

export type StackedBarsProps = {
  rows: readonly StackedBarsRow[]
  /** Segment order and colour. A segment keeps its slot whatever the row's ranking. */
  legend: readonly StackedBarsLegendItem[]
  ariaLabel: string
  valueFormat?: (value: number) => string
  emptyMessage?: string
  className?: string
}

/**
 * Horizontal stacked bars on one shared scale, so rows compare by total and by mix. Segments are
 * separated by a 2px surface gap (no strokes); hovering a row lists every segment with its share.
 */
export function StackedBars({
  rows,
  legend,
  ariaLabel,
  valueFormat = formatNumber,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: StackedBarsProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const prepared = useMemo(
    () =>
      withKeys(rows, (row) => row.label).map(({ key, item }) => {
        const segments = legend.map((entry) => ({
          ...entry,
          value: toCount(item.segments.find((segment) => segment.key === entry.key)?.value ?? 0),
        }))
        return { key, label: item.label, segments, total: sumOf(segments.map((s) => s.value)) }
      }),
    [rows, legend],
  )
  const max = maxOf(prepared.map((row) => row.total))

  if (prepared.length === 0 || max === 0) {
    return <ChartEmptyState message={emptyMessage} className={className} />
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ChartLegend
        items={legend.map((entry) => ({
          key: entry.key,
          label: entry.label,
          swatchClassName: TONE_BG[entry.tone],
        }))}
      />
      <ul aria-label={ariaLabel} className="flex flex-col gap-3">
        {prepared.map((row) => {
          const hovered = hoveredKey === row.key
          return (
            <li
              key={row.key}
              className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 [grid-template-areas:'label_total'_'bar_bar'] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] sm:[grid-template-areas:'label_bar_total']"
              onPointerEnter={() => setHoveredKey(row.key)}
              onPointerLeave={() => setHoveredKey(null)}
            >
              <span className="truncate text-sm text-fg [grid-area:label]" title={row.label}>
                {row.label}
              </span>
              <div
                aria-hidden="true"
                className={cn(
                  'flex h-3 transition-opacity duration-150 [grid-area:bar]',
                  hoveredKey !== null && !hovered && 'opacity-40',
                )}
              >
                <div
                  className="flex h-full gap-0.5 overflow-hidden rounded-r-sm motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out-quart"
                  style={{ width: `${(row.total / max) * 100}%` }}
                >
                  {row.segments
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <div
                        key={segment.key}
                        className={cn('h-full min-w-0.5', TONE_BG[segment.tone])}
                        style={{ flex: `${segment.value} 1 0%` }}
                      />
                    ))}
                </div>
              </div>
              <span className="text-right text-sm font-medium text-fg tabular [grid-area:total]">
                {valueFormat(row.total)}
              </span>
              <span className="sr-only">
                {row.segments
                  .map((segment) => `${segment.label}: ${valueFormat(segment.value)}`)
                  .join(', ')}
              </span>
              {hovered && (
                <ChartTooltip
                  className="top-full left-0 mt-2 sm:left-[11.75rem]"
                  title={row.label}
                  rows={[
                    ...row.segments.map((segment) => ({
                      key: segment.key,
                      tone: segment.tone,
                      value: valueFormat(segment.value),
                      label: segment.label,
                      meta: row.total > 0 ? formatPercent(segment.value / row.total) : undefined,
                    })),
                    { key: 'total', value: valueFormat(row.total), label: 'Toplam' },
                  ]}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
