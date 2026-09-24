import { LoaderCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes'

export type { ButtonSize, ButtonVariant } from './button-classes'

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, keeps the width and blocks clicks (`aria-busy`). */
  loading?: boolean
  leadingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  leadingIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-[inherit]">
            {leadingIcon}
            {children}
          </span>
          <LoaderCircle aria-hidden="true" className="absolute animate-spin" />
        </>
      ) : (
        <>
          {leadingIcon}
          {children}
        </>
      )}
    </button>
  )
}
