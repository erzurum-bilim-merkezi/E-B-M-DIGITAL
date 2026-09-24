import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import { Button } from './Button'

/**
 * Responsive table wrapper (scrolls horizontally on narrow screens, keeps the caption). `relative`
 * keeps the absolutely positioned sr-only caption inside the scroll box, so the page itself never
 * pans sideways at 320 px (WCAG 1.4.10).
 */
export function Table({
  className,
  caption,
  children,
  ...props
}: ComponentProps<'table'> & { caption?: ReactNode }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead className={cn('border-b border-border bg-surface-muted/60', className)} {...props} />
  )
}

export function TH({ className, scope = 'col', ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope={scope}
      className={cn(
        'h-10 px-4 text-xs font-medium whitespace-nowrap text-fg-muted first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TR({
  className,
  interactive,
  ...props
}: ComponentProps<'tr'> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        interactive && 'focus-within:bg-surface-muted/60 hover:bg-surface-muted/60',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('h-12 px-4 align-middle first:pl-5 last:pr-5', className)} {...props} />
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  label = 'Sayfalama',
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  total?: number
  label?: string
}) {
  if (pageCount <= 1) {
    return total !== undefined ? (
      <p className="text-sm text-fg-muted tabular">{total} kayıt</p>
    ) : null
  }
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <p className="text-sm text-fg-muted tabular">
        {total !== undefined && `${total} kayıt · `}Sayfa {page} / {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leadingIcon={<ChevronLeft aria-hidden="true" />}
        >
          Önceki
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Sonraki
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
