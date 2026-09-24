import { cn } from '@/shared/lib/cn'

export type ChartLegendItem = { key: string; label: string; swatchClassName: string }

/**
 * Identity is never colour alone: every swatch sits next to its name. The swatch mirrors the mark
 * — a short line for lines, a small rectangle for bars and areas. Text stays in text tokens.
 */
export function ChartLegend({
  items,
  shape = 'rect',
  className,
}: {
  items: readonly ChartLegendItem[]
  shape?: 'rect' | 'line'
  className?: string
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <span
            aria-hidden="true"
            className={cn(
              'shrink-0',
              shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-xs',
              item.swatchClassName,
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
