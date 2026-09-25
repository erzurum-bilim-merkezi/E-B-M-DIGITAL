import { cn } from '@/shared/lib/cn'

const variants = {
  primary: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
  secondary:
    'bg-surface text-fg shadow-xs ring-1 ring-border-strong ring-inset hover:bg-surface-muted',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  subtle: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary-subtle/70',
  danger: 'bg-danger text-danger-contrast shadow-xs hover:bg-danger-hover',
  'danger-ghost': 'text-danger hover:bg-danger-subtle',
} as const

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-sm [&_svg]:size-3.5',
  md: 'h-10 gap-2 px-4 text-sm [&_svg]:size-4',
  lg: 'h-12 gap-2 px-6 text-base [&_svg]:size-5',
  icon: 'size-9 [&_svg]:size-4',
  'icon-sm': 'size-8 [&_svg]:size-4',
} as const

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

/** Button look for other elements (e.g. a router `Link` styled as a button). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string | undefined
} = {}) {
  return cn(
    'relative inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap select-none',
    'transition-[background-color,color,box-shadow,translate] duration-150 ease-out-quart active:translate-y-px',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  )
}
