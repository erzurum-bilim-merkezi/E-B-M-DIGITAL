import { formatNumber, formatShortDate } from '@/shared/lib/format'

import type { ChartTone } from './types'

export const CHART_EMPTY_MESSAGE = 'Bu aralıkta veri yok'

// ---------------------------------------------------------------------------------------------
// Tone → class maps. Written out in full so Tailwind can see every class verbatim.
// ---------------------------------------------------------------------------------------------

export const TONE_BG: Record<ChartTone, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
  6: 'bg-chart-6',
}

export const TONE_STROKE: Record<ChartTone, string> = {
  1: 'stroke-chart-1',
  2: 'stroke-chart-2',
  3: 'stroke-chart-3',
  4: 'stroke-chart-4',
  5: 'stroke-chart-5',
  6: 'stroke-chart-6',
}

/** A soft wash of the series hue, for bars that sit behind text. */
export const TONE_WASH: Record<ChartTone, string> = {
  1: 'bg-chart-1/20',
  2: 'bg-chart-2/20',
  3: 'bg-chart-3/20',
  4: 'bg-chart-4/20',
  5: 'bg-chart-5/20',
  6: 'bg-chart-6/20',
}

/** Area fill under a line: the series hue at ~10 %. */
export const TONE_AREA: Record<ChartTone, string> = {
  1: 'fill-chart-1/10',
  2: 'fill-chart-2/10',
  3: 'fill-chart-3/10',
  4: 'fill-chart-4/10',
  5: 'fill-chart-5/10',
  6: 'fill-chart-6/10',
}

/** Sets `currentColor` for SVG gradient stops. Never used on text. */
export const TONE_CURRENT_COLOR: Record<ChartTone, string> = {
  1: 'text-chart-1',
  2: 'text-chart-2',
  3: 'text-chart-3',
  4: 'text-chart-4',
  5: 'text-chart-5',
  6: 'text-chart-6',
}

// ---------------------------------------------------------------------------------------------
// Numbers and labels
// ---------------------------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Largest finite value, never below 0 (charts here plot counts). */
export function maxOf(values: Iterable<number>) {
  let max = 0
  for (const value of values) if (Number.isFinite(value) && value > max) max = value
  return max
}

export function sumOf(values: Iterable<number>) {
  let sum = 0
  for (const value of values) if (Number.isFinite(value)) sum += value
  return sum
}

/** Negative and non-finite values become 0 — every chart here plots counts. */
export function toCount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

const compactFormatter = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Axis ticks: `1.500`, then compact from ten thousand (`12 B`, `1,2 Mn`). */
export function formatAxisValue(value: number) {
  return Math.abs(value) >= 10_000 ? compactFormatter.format(value) : formatNumber(value)
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** `2026-09-01` → `1 Eyl`; any other label is shown as is. */
export function formatChartLabel(label: string) {
  // Noon UTC is the same calendar day in Istanbul (UTC+3), whatever the device zone.
  return ISO_DAY.test(label) ? formatShortDate(`${label}T12:00:00Z`) : label
}

/** "aktif kâşif" → "Aktif kâşif" (Turkish casing: i → İ). */
export function sentenceCase(text: string) {
  return text.charAt(0).toLocaleUpperCase('tr') + text.slice(1)
}

/**
 * Stable React keys from labels. Duplicates get an occurrence suffix instead of the array index,
 * so a key follows its item when the list is re-sorted.
 */
export function withKeys<T>(items: readonly T[], base: (item: T) => string) {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const root = base(item)
    const count = (seen.get(root) ?? 0) + 1
    seen.set(root, count)
    return { key: count === 1 ? root : `${root}#${count}`, item }
  })
}

// ---------------------------------------------------------------------------------------------
// Scales and geometry. Plots use a 0–100 viewBox on both axes; y grows downwards.
// ---------------------------------------------------------------------------------------------

/**
 * A zero-based axis with round steps (1/2/5 × 10ⁿ; 2.5 only where it stays whole) and about
 * `targetIntervals` gridlines. `max` is the top tick, so the data never touches the frame by accident.
 */
export function niceScale(maxValue: number, { integer = true, targetIntervals = 4 } = {}) {
  if (!(maxValue > 0) || !Number.isFinite(maxValue)) return { max: 1, ticks: [0] }
  const rough = maxValue / targetIntervals
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / magnitude
  const candidates = integer && magnitude < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]
  const nice = candidates.find((candidate) => residual <= candidate) ?? 10
  let step = nice * magnitude
  if (integer) step = Math.max(1, Math.round(step))
  const intervals = Math.max(1, Math.ceil(maxValue / step - 1e-9))
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => round(index * step, 10))
  return { max: round(intervals * step, 10), ticks }
}

/**
 * At most `maxTicks` label positions, first and last included. An exactly even step wins when one
 * exists with (almost) as many labels (7 days → 0, 2, 4, 6); otherwise the most labels whose gaps
 * stay within a third of each other, so two neighbours never crowd (14 days → no "17 Eyl 18 Eyl").
 */
export function pickTickIndices(count: number, maxTicks: number) {
  if (count <= 0) return []
  if (count === 1) return [0]
  if (count <= maxTicks) return Array.from({ length: count }, (_, index) => index)
  const span = count - 1
  for (const ticks of [maxTicks, maxTicks - 1]) {
    if (ticks >= 3 && span % (ticks - 1) === 0) {
      const step = span / (ticks - 1)
      return Array.from({ length: ticks }, (_, tick) => tick * step)
    }
  }
  const place = (ticks: number) => [
    ...new Set(Array.from({ length: ticks }, (_, tick) => Math.round((tick * span) / (ticks - 1)))),
  ]
  for (let ticks = maxTicks; ticks >= 3; ticks--) {
    const indices = place(ticks)
    const gaps = indices.slice(1).map((index, position) => index - (indices[position] ?? 0))
    if (Math.min(...gaps) / Math.max(...gaps) >= 0.66) return indices
  }
  return place(Math.max(2, Math.min(maxTicks, 3)))
}

export type Point = { x: number; y: number }

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const fmt = (point: Point) => `${round(point.x)},${round(point.y)}`

/** Steffen tangent: keeps each segment monotone, so the curve never invents peaks or dips. */
function interiorTangent(h0: number, h1: number, s0: number, s1: number) {
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p))
}

/** Smooth, monotone cubic path through the points (d3 `curveMonotoneX`). */
export function monotonePath(points: readonly Point[]) {
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M${fmt(first)}`
  if (points.length === 2) return `M${fmt(first)}L${fmt(points[1] ?? first)}`

  const widths: number[] = []
  const slopes: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] ?? first
    const b = points[i + 1] ?? a
    const width = b.x - a.x || 1e-9
    widths.push(width)
    slopes.push((b.y - a.y) / width)
  }
  const tangents: number[] = points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return 0
    return interiorTangent(widths[i - 1] ?? 1, widths[i] ?? 1, slopes[i - 1] ?? 0, slopes[i] ?? 0)
  })
  const last = points.length - 1
  tangents[0] = (3 * (slopes[0] ?? 0) - (tangents[1] ?? 0)) / 2
  tangents[last] = (3 * (slopes[last - 1] ?? 0) - (tangents[last - 1] ?? 0)) / 2

  let path = `M${fmt(first)}`
  for (let i = 0; i < last; i++) {
    const a = points[i] ?? first
    const b = points[i + 1] ?? a
    const third = (b.x - a.x) / 3
    const c1 = { x: a.x + third, y: a.y + third * (tangents[i] ?? 0) }
    const c2 = { x: b.x - third, y: b.y - third * (tangents[i + 1] ?? 0) }
    path += `C${fmt(c1)} ${fmt(c2)} ${fmt(b)}`
  }
  return path
}

/** The line path closed down to the baseline (y = 100). */
export function areaPath(points: readonly Point[]) {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || points.length < 2) return ''
  return `${monotonePath(points)}L${round(last.x)},100L${round(first.x)},100Z`
}

// ---------------------------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------------------------

export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const
export const WEEKDAY_LONG = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const
export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export const formatHour = (hour: number) => `${String(hour % 24).padStart(2, '0')}:00`

/** `14` → `14:00–15:00`. */
export const formatHourRange = (hour: number) => `${formatHour(hour)}–${formatHour(hour + 1)}`

/** Always 7 × 24 non-negative counts, whatever shape arrives. */
export function normalizeHeatmap(matrix: readonly (readonly number[])[]) {
  return DAYS.map((day) => HOURS.map((hour) => toCount(matrix[day]?.[hour] ?? 0)))
}

/** 0 = no activity, 1–5 = quantised share of the busiest cell. */
export function heatLevel(value: number, max: number) {
  if (!(value > 0) || !(max > 0)) return 0
  return clamp(Math.ceil((value / max) * 5), 1, 5)
}

// ---------------------------------------------------------------------------------------------
// Meter
// ---------------------------------------------------------------------------------------------

export type MeterTone = 'normal' | 'warning' | 'danger'

/** Quota thresholds from the capacity plan: warn at 70 %, alarm at 85 %. */
export function meterTone(ratio: number): MeterTone {
  if (ratio >= 0.85) return 'danger'
  if (ratio >= 0.7) return 'warning'
  return 'normal'
}
