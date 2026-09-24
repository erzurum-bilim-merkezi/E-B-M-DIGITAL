import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'

import { ChartEmptyState } from './ChartEmptyState'
import {
  CHART_EMPTY_MESSAGE,
  DAYS,
  formatHour,
  formatHourRange,
  heatLevel,
  HOURS,
  normalizeHeatmap,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from './chart-utils'

export type HeatmapProps = {
  /** 7 rows (Monday … Sunday) × 24 hours, Europe/Istanbul. */
  matrix: readonly (readonly number[])[]
  ariaLabel: string
  /** Unit in titles and the readout. */
  valueLabel?: string
  emptyMessage?: string
  className?: string
}

/*
 * Sequential scale: one hue, more is stronger. Zero keeps the neutral muted surface so "no
 * activity" reads as nothing; steps 1–5 are monotone in lightness in both themes.
 */
const LEVEL_CLASSES = [
  'bg-surface-muted',
  'bg-chart-1/15',
  'bg-chart-1/30',
  'bg-chart-1/50',
  'bg-chart-1/75',
  'bg-chart-1',
] as const

const levelClass = (level: number) => LEVEL_CLASSES[level] ?? LEVEL_CLASSES[0]

type Cell = { day: number; hour: number }

/**
 * Weekday × hour activity grid, built as a real table: screen readers get row and column headers
 * for every cell, each cell carries a `title`, and the readout names the busiest hour.
 */
export function Heatmap({
  matrix,
  ariaLabel,
  valueLabel = 'etkinlik',
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: HeatmapProps) {
  const [active, setActive] = useState<Cell | null>(null)
  const grid = useMemo(() => normalizeHeatmap(matrix), [matrix])
  const peak = useMemo(() => {
    let best = { day: 0, hour: 0, value: 0 }
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const value = grid[day]?.[hour] ?? 0
        if (value > best.value) best = { day, hour, value }
      }
    }
    return best
  }, [grid])

  if (peak.value === 0) {
    return <ChartEmptyState message={emptyMessage} minHeight={220} className={className} />
  }

  const valueAt = ({ day, hour }: Cell) => grid[day]?.[hour] ?? 0
  const describe = (cell: Cell) =>
    `${WEEKDAY_LONG[cell.day] ?? ''} ${formatHourRange(cell.hour)} · ${formatNumber(valueAt(cell))} ${valueLabel}`

  const handlePointerOver = (event: ReactPointerEvent<HTMLTableSectionElement>) => {
    const cell = event.target instanceof Element ? event.target.closest('td[data-day]') : null
    if (!(cell instanceof HTMLElement)) return
    const day = Number(cell.dataset['day'])
    const hour = Number(cell.dataset['hour'])
    if (Number.isInteger(day) && Number.isInteger(hour)) setActive({ day, hour })
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <table
        className="w-full table-fixed border-separate border-spacing-0.5"
        onPointerLeave={() => setActive(null)}
      >
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className="relative w-9 p-0 sm:w-10">
              <span className="sr-only">Gün</span>
            </th>
            {HOURS.map((hour) => (
              <th
                key={hour}
                scope="col"
                className="relative h-5 p-0 text-left align-bottom text-xs leading-none font-normal whitespace-nowrap text-fg-subtle tabular"
              >
                {hour % 3 === 0 && <span aria-hidden="true">{formatHour(hour).slice(0, 2)}</span>}
                <span className="sr-only">{formatHour(hour)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody onPointerOver={handlePointerOver}>
          {DAYS.map((day) => (
            <tr key={day}>
              <th
                scope="row"
                className="relative pr-2 text-left text-xs leading-none font-normal text-fg-muted"
              >
                <span aria-hidden="true">{WEEKDAY_SHORT[day]}</span>
                <span className="sr-only">{WEEKDAY_LONG[day]}</span>
              </th>
              {HOURS.map((hour) => {
                const value = valueAt({ day, hour })
                const isActive = active?.day === day && active.hour === hour
                return (
                  <td
                    key={hour}
                    data-day={day}
                    data-hour={hour}
                    title={describe({ day, hour })}
                    className={cn(
                      'relative h-4 rounded-xs p-0 sm:h-6',
                      levelClass(heatLevel(value, peak.value)),
                      isActive && 'outline-2 -outline-offset-1 outline-fg-muted',
                    )}
                  >
                    <span className="sr-only">{formatNumber(value)}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-h-4 text-xs text-fg-muted tabular">
          {active ? (
            describe(active)
          ) : (
            <>
              En yoğun: <span className="font-medium text-fg">{describe(peak)}</span>
            </>
          )}
        </p>
        <div aria-hidden="true" className="flex items-center gap-1.5 text-xs text-fg-muted">
          <span>Az</span>
          {LEVEL_CLASSES.map((classes) => (
            <span key={classes} className={cn('size-3 rounded-xs', classes)} />
          ))}
          <span>Çok</span>
        </div>
      </div>
    </div>
  )
}
