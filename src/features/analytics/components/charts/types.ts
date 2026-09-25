/**
 * Categorical chart slot → the `chart-1` … `chart-6` tokens. Assign slots in this fixed order and
 * keep them on the entity (never on its rank): the order is what keeps neighbours colour-blind safe.
 */
export type ChartTone = 1 | 2 | 3 | 4 | 5 | 6

export type TrendPoint = { label: string; value: number }

/** An extra line on a `TrendChart`, index-aligned with `data`. Same y axis — never a second scale. */
export type TrendSeries = { label: string; values: readonly number[]; tone: ChartTone }

export type BarListItem = {
  label: string
  sublabel?: string
  value: number
  /** In-app route; the row becomes a link. */
  href?: string
}

export type FunnelStep = {
  label: string
  code?: string
  opens: number
  completes: number
  avgDurationMs?: number
}

export type StackedBarsSegment = { key: string; value: number }
export type StackedBarsRow = { label: string; segments: readonly StackedBarsSegment[] }
export type StackedBarsLegendItem = { key: string; label: string; tone: ChartTone }

export type ChartTableCell = string | number

/** Table twin of a chart (WCAG 1.1.1). The first column is the row header. */
export type ChartTable = {
  columns: readonly string[]
  rows: readonly (readonly ChartTableCell[])[]
}
