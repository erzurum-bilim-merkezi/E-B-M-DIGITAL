import { TrendingDown } from 'lucide-react'
import { useMemo } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatDuration, formatNumber, formatPercent } from '@/shared/lib/format'
import { Badge } from '@/shared/ui'

import { ChartEmptyState } from './ChartEmptyState'
import { ChartLegend } from './ChartLegend'
import { CHART_EMPTY_MESSAGE, maxOf, toCount, withKeys } from './chart-utils'
import type { FunnelStep } from './types'

export type FunnelChartProps = {
  steps: readonly FunnelStep[]
  ariaLabel?: string
  /** Flag the step that loses the largest share of its explorers (default on). */
  highlightDropOff?: boolean
  emptyMessage?: string
  className?: string
}

/*
 * Opens → completes is an ordered pair, so both bars share one hue: the lighter step for opens
 * (2.1:1 light / 2.6:1 dark on the surface) and the full step for completes.
 */
const OPENS_BAR = 'bg-chart-1/50'
const COMPLETES_BAR = 'bg-chart-1'

/** Per-card funnel: how many opened, how many completed, conversion and where explorers stop. */
export function FunnelChart({
  steps,
  ariaLabel = 'Kart hunisi',
  highlightDropOff = true,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: FunnelChartProps) {
  const rows = useMemo(
    () =>
      withKeys(steps, (step) => step.code ?? step.label).map(({ key, item }) => {
        const opens = toCount(item.opens)
        const completes = toCount(item.completes)
        return {
          key,
          step: item,
          opens,
          completes,
          conversion: opens > 0 ? completes / opens : null,
          dropped: Math.max(0, opens - completes),
        }
      }),
    [steps],
  )
  const max = maxOf(rows.flatMap((row) => [row.opens, row.completes]))

  const worstKey = useMemo(() => {
    if (!highlightDropOff || rows.length < 2) return null
    let worst: { key: string; rate: number } | null = null
    for (const row of rows) {
      if (row.opens === 0) continue
      const rate = row.dropped / row.opens
      if (rate > 0 && (!worst || rate > worst.rate)) worst = { key: row.key, rate }
    }
    return worst?.key ?? null
  }, [highlightDropOff, rows])

  if (rows.length === 0 || max === 0) {
    return <ChartEmptyState message={emptyMessage} className={className} />
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ChartLegend
        items={[
          { key: 'opens', label: 'Açılış', swatchClassName: OPENS_BAR },
          { key: 'completes', label: 'Tamamlama', swatchClassName: COMPLETES_BAR },
        ]}
      />
      <ol aria-label={ariaLabel} className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.key}
            className="grid gap-x-6 gap-y-2.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {row.step.code && (
                  <span className="shrink-0 text-xs font-medium text-fg-subtle tabular">
                    {row.step.code}
                  </span>
                )}
                <span
                  className="max-w-full min-w-0 truncate text-sm font-medium text-fg"
                  title={row.step.label}
                >
                  {row.step.label}
                </span>
                {row.key === worstKey && (
                  <Badge variant="warning" className="h-5 gap-1 px-2">
                    <TrendingDown aria-hidden="true" className="size-3" />
                    En çok bırakılan
                  </Badge>
                )}
              </div>
              {/* One figure pair per line, so a narrow column never strands a separator. */}
              <p className="text-xs text-fg-muted tabular">
                {row.conversion === null ? (
                  'Henüz açılmadı'
                ) : (
                  <>
                    <span className="font-semibold text-fg">{formatPercent(row.conversion)}</span>{' '}
                    dönüşüm
                    {row.dropped > 0 && <> · {formatNumber(row.dropped)} kâşif bıraktı</>}
                  </>
                )}
              </p>
              {row.step.avgDurationMs ? (
                <p className="text-xs text-fg-muted tabular">
                  Ortalama {formatDuration(row.step.avgDurationMs)}
                </p>
              ) : null}
            </div>
            {row.opens + row.completes > 0 && (
              <div className="flex flex-col gap-1.5">
                <FunnelBar value={row.opens} max={max} barClassName={OPENS_BAR} unit="açılış" />
                <FunnelBar
                  value={row.completes}
                  max={max}
                  barClassName={COMPLETES_BAR}
                  unit="tamamlama"
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function FunnelBar({
  value,
  max,
  barClassName,
  unit,
}: {
  value: number
  max: number
  barClassName: string
  unit: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
      <div aria-hidden="true" className="h-2.5">
        <div
          className={cn(
            'h-full rounded-r-sm motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out-quart',
            value > 0 && 'min-w-0.5',
            barClassName,
          )}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-right text-xs text-fg-muted tabular">
        <span className="font-medium text-fg">{formatNumber(value)}</span>
        <span className="sr-only"> {unit}</span>
      </span>
    </div>
  )
}
