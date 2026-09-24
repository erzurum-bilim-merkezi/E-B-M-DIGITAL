import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'

import { ChartEmptyState } from './ChartEmptyState'
import { CHART_EMPTY_MESSAGE, maxOf, toCount, TONE_WASH, withKeys } from './chart-utils'
import type { BarListItem, ChartTone } from './types'

export type BarListProps = {
  items: readonly BarListItem[]
  valueFormat?: (value: number) => string
  ariaLabel: string
  /** One series → one slot for every bar (never a value ramp on nominal categories). */
  tone?: ChartTone
  /** Rank by value, largest first (default). */
  sort?: boolean
  emptyMessage?: string
  className?: string
}

const rowClasses =
  'grid h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md pr-2 text-left'

/**
 * Ranked horizontal bars: label over a soft bar, value in an aligned right column. Every value is
 * printed, so nothing hides behind hover; rows with `href` are links to the detail view.
 */
export function BarList({
  items,
  valueFormat = formatNumber,
  ariaLabel,
  tone = 1,
  sort = true,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: BarListProps) {
  const rows = useMemo(() => {
    const keyed = withKeys(items, (item) => item.href ?? `${item.label}|${item.sublabel ?? ''}`)
    return sort ? keyed.toSorted((a, b) => toCount(b.item.value) - toCount(a.item.value)) : keyed
  }, [items, sort])
  const max = maxOf(rows.map(({ item }) => toCount(item.value)))

  if (rows.length === 0 || max === 0) {
    return <ChartEmptyState message={emptyMessage} className={className} />
  }

  return (
    <ul aria-label={ariaLabel} className={cn('flex flex-col gap-1', className)}>
      {rows.map(({ key, item }) => {
        const value = toCount(item.value)
        const content: ReactNode = (
          <>
            <span className="relative flex h-full min-w-0 items-center">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0 left-0 rounded-r-sm motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out-quart',
                  TONE_WASH[tone],
                )}
                style={{ width: `${(value / max) * 100}%` }}
              />
              {/* One clipped line: a sublabel that does not fit whole wraps out of view instead of
                  squeezing the label (it stays in the title, the table and for screen readers). */}
              <span className="relative flex h-5 min-w-0 flex-wrap items-baseline gap-x-2 overflow-hidden px-2.5">
                <span
                  className={cn(
                    'max-w-full truncate text-sm leading-5 text-fg',
                    item.href && 'underline-offset-2 group-hover:underline',
                  )}
                >
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="shrink-0 text-xs leading-5 text-fg-muted">{item.sublabel}</span>
                )}
              </span>
            </span>
            <span className="text-sm font-medium text-fg tabular">{valueFormat(value)}</span>
          </>
        )
        return (
          <li key={key} title={item.sublabel ? `${item.label} · ${item.sublabel}` : item.label}>
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  rowClasses,
                  'group transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                {content}
              </Link>
            ) : (
              <div className={rowClasses}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
