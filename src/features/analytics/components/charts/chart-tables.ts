import { formatDuration, formatPercent } from '@/shared/lib/format'

import {
  formatChartLabel,
  formatHourRange,
  HOURS,
  normalizeHeatmap,
  sentenceCase,
  toCount,
  WEEKDAY_SHORT,
} from './chart-utils'
import type {
  BarListItem,
  ChartTable,
  FunnelStep,
  StackedBarsLegendItem,
  StackedBarsRow,
  TrendPoint,
  TrendSeries,
} from './types'

/*
 * Table twins for `DataTableToggle`: the same numbers every chart draws, as rows (WCAG 1.1.1).
 * Numbers stay numbers so the table can format and right-align them.
 */

export function trendTable({
  data,
  series = [],
  valueLabel,
  formatLabel = formatChartLabel,
  labelHeader = 'Tarih',
}: {
  data: readonly TrendPoint[]
  series?: readonly TrendSeries[]
  valueLabel: string
  formatLabel?: (label: string) => string
  labelHeader?: string
}): ChartTable {
  return {
    columns: [
      labelHeader,
      sentenceCase(valueLabel),
      ...series.map((line) => sentenceCase(line.label)),
    ],
    rows: data.map((point, index) => [
      formatLabel(point.label),
      toCount(point.value),
      ...series.map((line) => toCount(line.values[index] ?? 0)),
    ]),
  }
}

export function barListTable(
  items: readonly BarListItem[],
  {
    labelHeader = 'Ad',
    sublabelHeader,
    valueHeader = 'Değer',
  }: { labelHeader?: string; sublabelHeader?: string; valueHeader?: string } = {},
): ChartTable {
  const withSublabel = sublabelHeader !== undefined
  return {
    columns: withSublabel ? [labelHeader, sublabelHeader, valueHeader] : [labelHeader, valueHeader],
    rows: items.map((item) =>
      withSublabel
        ? [item.label, item.sublabel ?? '', toCount(item.value)]
        : [item.label, toCount(item.value)],
    ),
  }
}

export function funnelTable(steps: readonly FunnelStep[]): ChartTable {
  return {
    columns: ['Kart', 'Açılış', 'Tamamlama', 'Dönüşüm', 'Bırakan', 'Ortalama süre'],
    rows: steps.map((step) => {
      const opens = toCount(step.opens)
      const completes = toCount(step.completes)
      return [
        step.code ? `${step.code} · ${step.label}` : step.label,
        opens,
        completes,
        opens > 0 ? formatPercent(completes / opens) : '—',
        Math.max(0, opens - completes),
        step.avgDurationMs ? formatDuration(step.avgDurationMs) : '—',
      ]
    }),
  }
}

export function stackedBarsTable(
  rows: readonly StackedBarsRow[],
  legend: readonly StackedBarsLegendItem[],
  { labelHeader = 'Ad' }: { labelHeader?: string } = {},
): ChartTable {
  return {
    columns: [labelHeader, ...legend.map((item) => item.label), 'Toplam'],
    rows: rows.map((row) => {
      const values = legend.map((item) =>
        toCount(row.segments.find((segment) => segment.key === item.key)?.value ?? 0),
      )
      return [row.label, ...values, values.reduce((sum, value) => sum + value, 0)]
    }),
  }
}

/** Hours as rows and weekdays as columns: eight columns stay readable on a phone. */
export function heatmapTable(matrix: readonly (readonly number[])[]): ChartTable {
  const grid = normalizeHeatmap(matrix)
  return {
    columns: ['Saat', ...WEEKDAY_SHORT],
    rows: HOURS.map((hour) => {
      const cells: (string | number)[] = [formatHourRange(hour)]
      for (const row of grid) cells.push(row[hour] ?? 0)
      return cells
    }),
  }
}
