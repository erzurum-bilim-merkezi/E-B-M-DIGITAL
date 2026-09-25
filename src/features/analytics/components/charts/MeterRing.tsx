import { OctagonAlert, TriangleAlert } from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/shared/lib/cn'
import { formatNumber, formatPercent } from '@/shared/lib/format'

import { CHART_EMPTY_MESSAGE, meterTone, type MeterTone } from './chart-utils'

export type MeterRingProps = {
  value: number
  max: number
  label: string
  /** Formats `value` and `max`, e.g. `formatBytes`. */
  format?: (value: number) => string
  emptyMessage?: string
  className?: string
}

/* The fill carries severity; the track is a lighter step of the same hue so state reads all round. */
const ARC: Record<MeterTone, string> = {
  normal: 'stroke-chart-1',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
}
const TRACK: Record<MeterTone, string> = {
  normal: 'stroke-chart-1/15',
  warning: 'stroke-warning/20',
  danger: 'stroke-danger/15',
}

/** Status is never colour alone: warning and danger always come with an icon and a label. */
function statusOf(tone: MeterTone, ratio: number) {
  if (tone === 'danger') {
    return {
      icon: OctagonAlert,
      text: 'text-danger-fg',
      label: ratio >= 1 ? 'Sınıra ulaşıldı' : 'Kritik seviyede',
    }
  }
  if (tone === 'warning') {
    return { icon: TriangleAlert, text: 'text-warning-fg', label: 'Sınıra yaklaşıyor' }
  }
  return null
}

/** Quota ring (storage, AI credits, MAU): %70 warns, %85 alarms. */
export function MeterRing({
  value,
  max,
  label,
  format = formatNumber,
  emptyMessage = CHART_EMPTY_MESSAGE,
  className,
}: MeterRingProps) {
  const labelId = useId()
  const valid = Number.isFinite(value) && Number.isFinite(max) && max > 0
  const used = valid ? Math.max(0, value) : 0
  const ratio = valid ? used / max : 0
  const tone = meterTone(ratio)
  const status = valid ? statusOf(tone, ratio) : null
  const arcLength = Math.min(100, ratio * 100)

  return (
    <div className={cn('flex items-center gap-4', className)} data-tone={valid ? tone : 'empty'}>
      <div className="relative size-20 shrink-0">
        <svg aria-hidden="true" viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle
            cx={18}
            cy={18}
            r={15.5}
            fill="none"
            strokeWidth={3}
            className={valid ? TRACK[tone] : 'stroke-surface-muted'}
          />
          {valid && arcLength > 0 && (
            <circle
              cx={18}
              cy={18}
              r={15.5}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${arcLength} 100`}
              className={cn(
                ARC[tone],
                'motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out-quart motion-safe:starting:[stroke-dasharray:0_100]',
              )}
            />
          )}
        </svg>
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center text-base font-semibold tracking-tight text-fg"
        >
          {valid ? formatPercent(ratio) : '—'}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <p id={labelId} className="truncate text-sm font-medium text-fg">
          {label}
        </p>
        {valid ? (
          <>
            <p aria-hidden="true" className="text-xs text-fg-muted tabular">
              {format(used)} / {format(max)}
            </p>
            {status && (
              <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', status.text)}>
                <status.icon aria-hidden="true" className="size-3.5 shrink-0" />
                {status.label}
              </p>
            )}
            <meter
              className="sr-only"
              min={0}
              max={max}
              value={Math.min(used, max)}
              low={max * 0.7}
              high={max * 0.85}
              optimum={0}
              aria-labelledby={labelId}
              aria-valuenow={Math.min(used, max)}
              aria-valuetext={`${formatPercent(ratio)} (${format(used)}, sınır ${format(max)})`}
            />
          </>
        ) : (
          <p className="text-xs text-fg-muted">{emptyMessage}</p>
        )}
      </div>
    </div>
  )
}
