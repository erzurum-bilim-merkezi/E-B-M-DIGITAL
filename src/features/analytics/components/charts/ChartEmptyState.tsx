import { ChartNoAxesColumn } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

import { CHART_EMPTY_MESSAGE } from './chart-utils'

/** Friendly placeholder that keeps the chart's footprint, so data arriving never shifts layout. */
export function ChartEmptyState({
  message = CHART_EMPTY_MESSAGE,
  minHeight,
  className,
}: {
  message?: string
  /** Match the chart's own height (px). */
  minHeight?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 px-4 py-8 text-center',
        className,
      )}
      style={minHeight ? { minHeight } : undefined}
    >
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full bg-surface-muted text-fg-subtle ring-1 ring-border ring-inset"
      >
        <ChartNoAxesColumn className="size-4" />
      </span>
      <p className="text-sm font-medium text-fg-muted">{message}</p>
    </div>
  )
}
