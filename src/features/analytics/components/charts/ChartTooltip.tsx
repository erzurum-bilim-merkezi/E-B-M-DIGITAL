import type { CSSProperties, ReactNode, Ref } from 'react'

import { cn } from '@/shared/lib/cn'

import { TONE_BG } from './chart-utils'
import type { ChartTone } from './types'

export type ChartTooltipRow = {
  key: string
  /** Series colour, drawn as a short line key (never a box — at tooltip density that is ink). */
  tone?: ChartTone
  value: string
  label: string
  /** Secondary figure on the right, e.g. a share. */
  meta?: string
}

/**
 * Visual-only readout for hover and keyboard focus. It is `aria-hidden`: the same values are
 * always reachable as text (slider value text, screen-reader summaries and the table view).
 * Values lead in strong ink; series names follow in muted ink.
 */
export function ChartTooltip({
  title,
  rows,
  className,
  style,
  ref,
}: {
  title: ReactNode
  rows: readonly ChartTooltipRow[]
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      role="tooltip"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-20 w-max max-w-64 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs shadow-lg',
        className,
      )}
      style={style}
    >
      <p className="mb-1.5 font-medium text-fg-muted">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 whitespace-nowrap">
            {row.tone !== undefined && (
              <span className={cn('h-0.5 w-3 shrink-0 rounded-full', TONE_BG[row.tone])} />
            )}
            <span className="font-semibold text-fg tabular">{row.value}</span>
            <span className="text-fg-muted">{row.label}</span>
            {row.meta && <span className="ml-auto pl-3 text-fg-subtle tabular">{row.meta}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
