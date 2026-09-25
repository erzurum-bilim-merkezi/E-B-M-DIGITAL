import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { Fragment, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

// ---------------------------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------------------------

const badgeVariants = {
  neutral: 'bg-surface-muted text-fg-muted ring-border',
  primary: 'bg-primary-subtle text-primary-subtle-fg ring-primary/20',
  success: 'bg-success-subtle text-success-fg ring-success/25',
  warning: 'bg-warning-subtle text-warning-fg ring-warning/30',
  danger: 'bg-danger-subtle text-danger-fg ring-danger/25',
  info: 'bg-info-subtle text-info-fg ring-info/25',
} as const
export type BadgeVariant = keyof typeof badgeVariants

export function Badge({
  variant = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: ComponentProps<'span'> & { variant?: BadgeVariant; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// Alert (inline banner)
// ---------------------------------------------------------------------------------------------

const alertVariants = {
  info: { classes: 'bg-info-subtle text-info-fg ring-info/25', icon: Info },
  success: { classes: 'bg-success-subtle text-success-fg ring-success/25', icon: CheckCircle2 },
  warning: { classes: 'bg-warning-subtle text-warning-fg ring-warning/30', icon: AlertTriangle },
  danger: { classes: 'bg-danger-subtle text-danger-fg ring-danger/25', icon: XCircle },
} as const

export function Alert({
  variant = 'info',
  title,
  action,
  className,
  children,
  role,
  ...props
}: Omit<ComponentProps<'div'>, 'title'> & {
  variant?: keyof typeof alertVariants
  title?: ReactNode
  action?: ReactNode
}) {
  const { classes, icon: Icon } = alertVariants[variant]
  return (
    <div
      role={role ?? (variant === 'danger' ? 'alert' : 'status')}
      className={cn('flex gap-3 rounded-lg p-3.5 text-sm ring-1 ring-inset', classes, className)}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed [&_a]:underline">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Card, skeleton, spinner, progress, kbd
// ---------------------------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface', className)} {...props} />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
  titleAs: TitleTag = 'h2',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  titleAs?: 'h2' | 'h3'
}) {
  return (
    <div
      className={cn('flex flex-wrap items-start gap-3 border-b border-border px-5 py-4', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TitleTag className="text-sm font-semibold text-fg">{title}</TitleTag>
        {description && <p className="text-xs text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} {...props} />
}

export function Spinner({
  className,
  label = 'Yükleniyor',
}: {
  className?: string
  label?: string
}) {
  return (
    <output className={cn('inline-flex items-center gap-2 text-sm text-fg-muted', className)}>
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-primary"
      />
      <span className="sr-only">{label}</span>
    </output>
  )
}

export function Progress({
  value,
  max = 1,
  label,
  className,
  tone = 'primary',
}: {
  value: number
  max?: number
  label: string
  className?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const tones = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom-styled bar with an animated fill; native <progress> cannot be themed or transitioned consistently
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out-quart',
          tones[tone],
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-muted px-1 font-sans text-[11px] font-medium text-fg-muted',
        className,
      )}
      {...props}
    />
  )
}

/** "Ctrl + K" rendered as keycaps. */
export function Shortcut({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- static keycaps; the same key may appear twice, so its position is part of the identity
        <Fragment key={`${key}-${index}`}>
          {index > 0 && <span className="text-xs text-fg-subtle">+</span>}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// Empty state, stat tile, avatar
// ---------------------------------------------------------------------------------------------

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
  titleAs: TitleTag = 'h2',
}: {
  illustration?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  titleAs?: 'h1' | 'h2' | 'h3' | 'p'
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      {illustration && <div className="mb-1">{illustration}</div>}
      <TitleTag className="text-base font-semibold text-fg">{title}</TitleTag>
      {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">{label}</p>
        {icon && (
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-primary-subtle text-primary-subtle-fg [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
      </div>
      <p className="font-display text-3xl font-semibold tracking-tight text-fg tabular">{value}</p>
      {(hint || trend) && (
        <p className="flex items-center gap-2 text-xs text-fg-muted">
          {trend && (
            <span
              className={cn(
                'font-medium',
                trend.direction === 'up' && 'text-success-fg',
                trend.direction === 'down' && 'text-danger-fg',
              )}
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}{' '}
              {trend.label}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase('tr'))
      .join('') || '?'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-subtle-fg',
        className,
      )}
    >
      {initials}
    </span>
  )
}

/** Page heading row with optional description and actions (one h1 per page). */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
