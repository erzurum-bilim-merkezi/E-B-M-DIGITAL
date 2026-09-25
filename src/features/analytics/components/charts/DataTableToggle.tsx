import { ChartColumn, Table2 } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { Button, Card, CardHeader, TBody, TD, TH, THead, TR } from '@/shared/ui'

import { withKeys } from './chart-utils'
import type { ChartTable, ChartTableCell } from './types'
import { useIsScrollable } from './useIsScrollable'

export type DataTableToggleProps = {
  title: string
  description?: ReactNode
  /** The chart. */
  children: ReactNode
  /** The same data as rows — see the `*Table` helpers next to each chart. */
  table: ChartTable
  titleAs?: 'h2' | 'h3'
  defaultView?: 'chart' | 'table'
  /** Refetching: keep the current frame, dimmed — no skeleton flash, no layout jump. */
  busy?: boolean
  className?: string
}

/**
 * Chart card with its accessible twin: one button swaps the chart for a real table of the same
 * data (WCAG 1.1.1). The button names the action, so its label flips instead of using
 * `aria-pressed` (a pressed toggle must keep one label).
 */
export function DataTableToggle({
  title,
  description,
  children,
  table,
  titleAs = 'h2',
  defaultView = 'chart',
  busy = false,
  className,
}: DataTableToggleProps) {
  const [view, setView] = useState(defaultView)
  const contentId = useId()
  const showTable = view === 'table'

  return (
    <Card className={cn('@container w-full min-w-0', className)} aria-busy={busy || undefined}>
      <CardHeader
        title={title}
        description={description}
        titleAs={titleAs}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="-my-1 -mr-2"
            aria-controls={contentId}
            // Narrow cards show just "Tablo"; the name stays the full phrase (label-in-name holds).
            aria-label={showTable ? 'Grafiği göster' : 'Tablo olarak göster'}
            leadingIcon={
              showTable ? <ChartColumn aria-hidden="true" /> : <Table2 aria-hidden="true" />
            }
            onClick={() => setView(showTable ? 'chart' : 'table')}
          >
            {showTable ? (
              'Grafiği göster'
            ) : (
              <span>
                Tablo<span className="hidden @sm:inline"> olarak göster</span>
              </span>
            )}
          </Button>
        }
      />
      <div id={contentId} className={cn('transition-opacity duration-200', busy && 'opacity-60')}>
        {showTable ? (
          <ChartDataTable caption={title} table={table} />
        ) : (
          <div className="p-5">{children}</div>
        )}
      </div>
    </Card>
  )
}

/** Numbers and figure-like strings (`%80`, `45 sn`, `—`) align right, in tabular figures. */
const isFigure = (cell: ChartTableCell | undefined) =>
  typeof cell === 'number' || (typeof cell === 'string' && /^[\d%—–-]/.test(cell.trim()))

const formatCell = (cell: ChartTableCell) => (typeof cell === 'number' ? formatNumber(cell) : cell)

function ChartDataTable({ caption, table }: { caption: string; table: ChartTable }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollable = useIsScrollable(scrollRef)
  const columns = withKeys(table.columns, (column) => column)
  const rows = withKeys(table.rows, (row) => String(row[0] ?? ''))
  const figureColumns = table.columns.map(
    (_, column) =>
      column > 0 && table.rows.length > 0 && table.rows.every((row) => isFigure(row[column])),
  )

  return (
    <div
      ref={scrollRef}
      // Focusable (and named) only while it scrolls, so keyboard users can reach every cell.
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? `${caption} tablosu` : undefined}
      tabIndex={scrollable ? 0 : undefined}
      className="max-h-[28rem] overflow-auto rounded-b-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <THead className="border-b-0 bg-transparent">
          <tr>
            {columns.map(({ key, item: column }, position) => (
              <TH
                key={key}
                className={cn(
                  'sticky top-0 z-10 bg-surface-muted shadow-[inset_0_-1px_0_var(--color-border)]',
                  figureColumns[position] && 'text-right',
                )}
              >
                {column}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {rows.map(({ key, item: row }) => {
            const [header = '', ...cells] = row
            return (
              <TR key={key}>
                <TH scope="row" className="h-10 text-sm font-normal whitespace-normal text-fg">
                  {formatCell(header)}
                </TH>
                {columns.slice(1).map(({ key: columnKey }, offset) => {
                  const cell = cells[offset]
                  return (
                    <TD
                      key={columnKey}
                      className={cn(
                        'h-10 whitespace-nowrap text-fg',
                        figureColumns[offset + 1] && 'text-right tabular',
                      )}
                    >
                      {cell === undefined ? '' : formatCell(cell)}
                    </TD>
                  )
                })}
              </TR>
            )
          })}
        </TBody>
      </table>
    </div>
  )
}
