import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'

import { ChartEmptyState } from './ChartEmptyState'
import { ChartLegend } from './ChartLegend'
import { ChartTooltip } from './ChartTooltip'
import {
  areaPath,
  CHART_EMPTY_MESSAGE,
  clamp,
  formatAxisValue,
  formatChartLabel,
  maxOf,
  monotonePath,
  niceScale,
  pickTickIndices,
  sentenceCase,
  toCount,
  TONE_BG,
  TONE_CURRENT_COLOR,
  TONE_STROKE,
  withKeys,
} from './chart-utils'
import type { ChartTone, TrendPoint, TrendSeries } from './types'

/** Space above and below the plot for tick and x-axis labels (px). */
const AXIS_BAND = 32
const TOOLTIP_GAP = 12
const NO_SERIES: readonly TrendSeries[] = []

export type TrendChartProps = {
  data: readonly TrendPoint[]
  /** Extra lines on the same y axis (e.g. QR scans next to active explorers). */
  series?: readonly TrendSeries[]
  ariaLabel: string
  /** Plot height in px, axis labels excluded. */
  height?: number
  /** Unit of the main series, e.g. "aktif kâşif". */
  valueLabel: string
  /** Defaults to `1 Eyl` for `YYYY-MM-DD` labels. */
  formatLabel?: (label: string) => string
  formatValue?: (value: number) => string
  /** Main series slot; extra series bring their own. */
  tone?: ChartTone
  emptyMessage?: string
  className?: string
}

type Line = { key: string; label: string; tone: ChartTone; values: number[] }

const xOf = (index: number, count: number) => (count <= 1 ? 50 : (index / (count - 1)) * 100)
const yOf = (value: number, max: number) => 100 - (clamp(value, 0, max) / max) * 100

/**
 * Line/area trend over time. Hover (or touch-drag) snaps a crosshair to the nearest point; the plot
 * is also a native slider, so arrow keys, Home/End and screen readers step through the same points.
 */
export function TrendChart({
  data,
  series = NO_SERIES,
  ariaLabel,
  height = 200,
  valueLabel,
  formatLabel = formatChartLabel,
  formatValue = formatNumber,
  tone = 1,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: TrendChartProps) {
  const gradientId = `trend-fill-${useId().replace(/[^\w-]/g, '')}`
  const plotRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [focused, setFocused] = useState(false)

  const count = data.length
  const lines = useMemo<Line[]>(
    () => [
      {
        key: 'main',
        label: valueLabel,
        tone,
        values: data.map((point) => toCount(point.value)),
      },
      ...withKeys(series, (line) => `series:${line.label}`).map(({ key, item }) => ({
        key,
        label: item.label,
        tone: item.tone,
        values: data.map((_, index) => toCount(item.values[index] ?? 0)),
      })),
    ],
    [data, series, tone, valueLabel],
  )
  const maxValue = useMemo(() => maxOf(lines.flatMap((line) => line.values)), [lines])
  const scale = useMemo(
    () =>
      niceScale(maxValue, {
        integer: lines.every((line) => line.values.every(Number.isInteger)),
      }),
    [lines, maxValue],
  )
  const paths = useMemo(
    () =>
      lines.map((line) => {
        const points = line.values.map((value, index) => ({
          x: xOf(index, line.values.length),
          y: yOf(value, scale.max),
        }))
        return {
          key: line.key,
          tone: line.tone,
          line: monotonePath(points),
          area: areaPath(points),
        }
      }),
    [lines, scale.max],
  )

  const current = clamp(focusIndex, 0, Math.max(0, count - 1))
  const activeIndex = count === 0 ? null : (hoverIndex ?? (focused ? current : null))

  // Keep the tooltip beside the crosshair and inside the plot, flipping sides near the right edge.
  // Runs after every render: the tooltip's width follows its content, which any prop can change.
  useLayoutEffect(() => {
    const plot = plotRef.current
    const tooltip = tooltipRef.current
    if (activeIndex === null || !plot || !tooltip) return
    const width = plot.clientWidth
    const tooltipWidth = tooltip.offsetWidth
    const x = (xOf(activeIndex, count) / 100) * width
    let left = x + TOOLTIP_GAP
    if (left + tooltipWidth > width) left = x - TOOLTIP_GAP - tooltipWidth
    tooltip.style.left = `${Math.max(0, Math.min(left, width - tooltipWidth))}px`
  })

  if (count === 0) {
    return (
      <ChartEmptyState
        message={emptyMessage}
        minHeight={height + AXIS_BAND}
        className={className}
      />
    )
  }

  const isFlat = maxValue === 0
  const ticks = isFlat ? [0] : scale.ticks
  // Label density follows the chart's own width (container queries), not the viewport:
  // 3 labels when narrow, 5 from 24rem, up to 8 from 42rem.
  const narrowTicks = new Set(pickTickIndices(count, 3))
  const mediumTicks = new Set(pickTickIndices(count, 5))
  const wideTicks = new Set(pickTickIndices(count, 8))
  const labelIndices = [...new Set([...narrowTicks, ...mediumTicks, ...wideTicks])].toSorted(
    (a, b) => a - b,
  )
  const multiSeries = lines.length > 1

  const describe = (index: number) =>
    `${formatLabel(data[index]?.label ?? '')}: ${lines
      .map((line) => `${formatValue(line.values[index] ?? 0)} ${line.label}`)
      .join(', ')}`

  const indexFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (count <= 1 || rect.width <= 0) return 0
    return Math.round(clamp((event.clientX - rect.left) / rect.width, 0, 1) * (count - 1))
  }
  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) =>
    setHoverIndex(indexFromPointer(event))
  const clearPointer = () => setHoverIndex(null)

  const moveFocus = (next: number) => {
    setHoverIndex(null)
    setFocusIndex(clamp(next, 0, count - 1))
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const jump = Math.max(1, Math.round(count / 5))
    const moves: Partial<Record<string, number>> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      PageUp: current + jump,
      PageDown: current - jump,
      Home: 0,
      End: count - 1,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    moveFocus(next)
  }

  const markerIndex = activeIndex ?? (count === 1 ? 0 : null)

  return (
    // `w-full`: a size container has no intrinsic width, so it must never size to its content.
    <div className={cn('@container flex w-full min-w-0 flex-col gap-4', className)}>
      {multiSeries && (
        <ChartLegend
          shape="line"
          items={lines.map((line) => ({
            key: line.key,
            label: sentenceCase(line.label),
            swatchClassName: TONE_BG[line.tone],
          }))}
        />
      )}

      <div>
        <div className="flex pt-1.5">
          {/* y axis: round ticks, tabular, recessive */}
          <div aria-hidden="true" className="relative w-10 shrink-0" style={{ height }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-2.5 -translate-y-1/2 text-xs leading-none text-fg-subtle tabular"
                style={{ top: `${yOf(tick, scale.max)}%` }}
              >
                {formatAxisValue(tick)}
              </span>
            ))}
          </div>

          <div
            ref={plotRef}
            className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y rounded-xs outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-ring"
            style={{ height }}
            onPointerMove={trackPointer}
            onPointerDown={trackPointer}
            onPointerLeave={clearPointer}
            onPointerCancel={clearPointer}
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={100}
                  y1={yOf(tick, scale.max)}
                  y2={yOf(tick, scale.max)}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  shapeRendering="crispEdges"
                  className={tick === 0 ? 'stroke-border-strong' : 'stroke-chart-grid'}
                />
              ))}
            </svg>

            {/* Data layer. Reveals left → right once, only when motion is welcome. */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full overflow-visible [clip-path:inset(-8px)] motion-safe:transition-[clip-path] motion-safe:duration-700 motion-safe:ease-out-quart motion-safe:starting:[clip-path:inset(-8px_100%_-8px_-8px)]"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {!multiSeries && !isFlat && paths[0] && (
                <>
                  <defs>
                    <linearGradient
                      id={gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                      className={TONE_CURRENT_COLOR[tone]}
                    >
                      <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d={paths[0].area} fill={`url(#${gradientId})`} />
                </>
              )}
              {paths.map((path) => (
                <path
                  key={path.key}
                  d={path.line}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={isFlat ? 'stroke-border-strong' : TONE_STROKE[path.tone]}
                />
              ))}
            </svg>

            {activeIndex !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-border-strong"
                style={{ left: `${xOf(activeIndex, count)}%` }}
              />
            )}
            {markerIndex !== null &&
              lines.map((line) => (
                <span
                  key={line.key}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface',
                    isFlat ? 'bg-border-strong' : TONE_BG[line.tone],
                  )}
                  style={{
                    left: `${xOf(markerIndex, count)}%`,
                    top: `${yOf(line.values[markerIndex] ?? 0, scale.max)}%`,
                  }}
                />
              ))}

            {isFlat && (
              <ChartEmptyState
                message={emptyMessage}
                className="pointer-events-none absolute inset-0 py-0"
              />
            )}

            {activeIndex !== null && (
              <ChartTooltip
                ref={tooltipRef}
                className="top-0"
                title={formatLabel(data[activeIndex]?.label ?? '')}
                rows={lines.map((line) => ({
                  key: line.key,
                  tone: multiSeries ? line.tone : undefined,
                  value: formatValue(line.values[activeIndex] ?? 0),
                  label: line.label,
                }))}
              />
            )}

            {/* Keyboard and assistive-technology access to every point. */}
            <input
              type="range"
              min={0}
              max={count - 1}
              step={1}
              value={current}
              aria-label={ariaLabel}
              aria-valuetext={describe(current)}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                moveFocus(Number(event.target.value))
              }
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="pointer-events-none absolute inset-0 m-0 size-full appearance-none bg-transparent opacity-0"
            />
          </div>
        </div>

        {/* x axis: sparse labels, denser as the chart widens; ends align to the plot edges */}
        <div
          aria-hidden="true"
          className="relative mt-2.5 ml-10 h-4 text-xs leading-4 text-fg-subtle"
        >
          {labelIndices.map((index) => (
            <span
              key={index}
              className={cn(
                'absolute top-0 whitespace-nowrap tabular',
                count === 1 || (index !== 0 && index !== count - 1) ? '-translate-x-1/2' : '',
                count > 1 && index === count - 1 && '-translate-x-full',
                narrowTicks.has(index) ? 'block' : 'hidden',
                mediumTicks.has(index) ? '@sm:block' : '@sm:hidden',
                wideTicks.has(index) ? '@2xl:block' : '@2xl:hidden',
              )}
              style={{ left: `${xOf(index, count)}%` }}
            >
              {formatLabel(data[index]?.label ?? '')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
