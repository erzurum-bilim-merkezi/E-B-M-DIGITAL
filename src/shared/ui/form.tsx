import { ChevronDown } from 'lucide-react'
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react'

import { cn } from '@/shared/lib/cn'

const controlBase = cn(
  'w-full rounded-md bg-surface text-sm text-fg shadow-xs ring-1 ring-control-border ring-inset',
  'transition-[box-shadow,background-color] duration-150 placeholder:text-fg-subtle',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle',
  'read-only:bg-surface-muted',
  'aria-invalid:ring-2 aria-invalid:ring-danger',
)

export type InputProps = ComponentProps<'input'>

export function Input({ className, type = 'text', ...props }: InputProps) {
  return <input type={type} className={cn(controlBase, 'h-10 px-3', className)} {...props} />
}

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, 'min-h-20 px-3 py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

export type SelectProps = ComponentProps<'select'>

/** Native select (best on touch devices and screen readers), styled to match inputs. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={cn(controlBase, 'h-10 cursor-pointer appearance-none pr-9 pl-3')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor is passed by callers
  return <label className={cn('text-sm font-medium text-fg', className)} {...props} />
}

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-required'?: boolean
}

/** Props a composite control (e.g. input + icon/button wrapper) spreads onto its real input. */
export type FieldRenderProps = {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  'aria-required': true | undefined
}

export type FieldProps = {
  label: ReactNode
  /** Help text under the label. */
  description?: ReactNode
  /** Error message; marks the control `aria-invalid` and announces it. */
  error?: ReactNode
  required?: boolean
  /** Visually hide the label (still announced). */
  hideLabel?: boolean
  /** Right side of the label row, e.g. a character counter. */
  aside?: ReactNode
  className?: string
  /**
   * The control. Pass a function when the input is wrapped (icon, "show password" button…):
   * spread the given props onto the real input so the label and messages reach it.
   */
  children: ReactElement<FieldControlProps> | ((control: FieldRenderProps) => ReactNode)
}

/**
 * Label + control + description + error, wired with `htmlFor`, `aria-describedby` and
 * `aria-invalid` so screen readers announce everything (WCAG 1.3.1, 3.3.1).
 */
export function Field({
  label,
  description,
  error,
  required,
  hideLabel,
  aside,
  className,
  children,
}: FieldProps) {
  const autoId = useId()
  const child = typeof children === 'function' ? null : Children.only(children)
  const id = (child && isValidElement(child) && child.props.id) || `field-${autoId}`
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy =
    [child?.props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') ||
    undefined
  const control: FieldRenderProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required ? true : undefined,
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
        <Label htmlFor={id}>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          )}
        </Label>
        {aside}
      </div>
      {description && (
        <p id={descriptionId} className="-mt-0.5 text-xs text-fg-muted">
          {description}
        </p>
      )}
      {typeof children === 'function'
        ? children(control)
        : child &&
          cloneElement(child, {
            id,
            'aria-describedby': describedBy,
            ...(error ? { 'aria-invalid': true } : {}),
            ...(required ? { 'aria-required': true } : {}),
          })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** "12 / 80" counter for length-limited fields. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const length = [...value].length
  return (
    <span className={cn('text-xs tabular', length > max ? 'text-danger' : 'text-fg-subtle')}>
      {length} / {max}
    </span>
  )
}
