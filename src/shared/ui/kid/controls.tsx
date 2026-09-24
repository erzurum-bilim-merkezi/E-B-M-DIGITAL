import type { ComponentProps, ReactNode, Ref } from 'react'

import { cn } from '@/shared/lib/cn'

/**
 * Kâşif controls: big (56–72 px), chunky 3D buttons that press down — the E-B-M feel,
 * with visible focus rings and real <button>s (R14).
 *
 * A button the child just pressed must not become `disabled` (focus would drop to <body>,
 * WCAG 2.4.3): pass `aria-disabled` and guard the handler instead — it looks disabled, stays
 * focusable and is announced as unavailable.
 */
const kidButtonVariants = {
  primary:
    'bg-kid-primary text-kid-primary-fg shadow-kid-3d hover:bg-kid-primary-hover active:shadow-kid-3d-pressed',
  accent:
    'bg-kid-accent text-kid-accent-fg shadow-kid-3d-accent hover:brightness-110 active:shadow-[0_2px_0_var(--kit-accent-shadow)]',
  surface:
    'bg-kid-surface text-kid-fg shadow-kid-soft ring-2 ring-kid-border hover:bg-kid-surface-2 active:shadow-none',
  ghost: 'bg-transparent text-kid-fg hover:bg-kid-surface/60',
  color: 'kid-color-card',
} as const

const kidButtonSizes = {
  md: 'min-h-14 px-5 text-lg rounded-[1.25rem]',
  lg: 'min-h-16 px-6 text-xl rounded-[1.375rem]',
  xl: 'min-h-[4.5rem] px-7 text-2xl rounded-[1.5rem]',
} as const

export type KidButtonProps = ComponentProps<'button'> & {
  variant?: keyof typeof kidButtonVariants
  size?: keyof typeof kidButtonSizes
  /** Card color for `variant="color"`. */
  color?: string
}

export function KidButton({
  variant = 'primary',
  size = 'md',
  color,
  type = 'button',
  className,
  ...props
}: KidButtonProps) {
  return (
    <button
      type={type}
      data-card-color={variant === 'color' ? color : undefined}
      className={cn(
        'kid-focus inline-flex items-center justify-center gap-2 font-semibold select-none',
        'transition-[transform,box-shadow,background-color,filter] duration-150 ease-out-quart active:translate-y-1',
        'disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:shadow-none aria-disabled:active:translate-y-0',
        kidButtonVariants[variant],
        kidButtonSizes[size],
        className,
      )}
      {...props}
    />
  )
}

export type KidIconButtonProps = ComponentProps<'button'> & {
  /** Required accessible name for icon-only buttons. */
  label: string
}

export function KidIconButton({
  label,
  type = 'button',
  className,
  children,
  ...props
}: KidIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'kid-focus grid size-14 shrink-0 place-items-center rounded-[1.25rem] bg-kid-surface text-2xl text-kid-fg shadow-kid-soft',
        'transition-transform duration-150 ease-out-quart hover:bg-kid-surface-2 active:scale-90',
        'disabled:pointer-events-none disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="leading-none">
        {children}
      </span>
    </button>
  )
}

/** Text field; its border carries the ≥ 3:1 boundary against the sky and panels (WCAG 1.4.11). */
export function KidInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'kid-focus h-16 w-full rounded-[1.25rem] border-2 border-kid-control-border bg-kid-surface px-5 text-2xl font-semibold text-kid-fg shadow-kid-soft',
        'placeholder:font-normal placeholder:text-kid-fg-soft/70 aria-invalid:border-kid-danger',
        className,
      )}
      {...props}
    />
  )
}

/** White rounded panel (stage, answer box, forms). */
export function KidPanel({
  className,
  as: Tag = 'div',
  ...props
}: ComponentProps<'div'> & { as?: 'div' | 'section' | 'article' }) {
  return (
    <Tag
      className={cn('rounded-kid bg-kid-surface p-5 text-kid-fg shadow-kid-card', className)}
      {...props}
    />
  )
}

/** "Kart 3 / 7" pill. */
export function StepChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-11 items-center rounded-full bg-kid-surface px-4 text-base font-semibold whitespace-nowrap text-kid-fg-soft shadow-kid-soft',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Gently bouncing instruction ("👆 Tohuma dokun!"). */
export function HintText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'kid-ambient [animation:kid-bounce_2s_ease-in-out_infinite] text-center text-base font-semibold text-kid-fg-soft',
        className,
      )}
    >
      {children}
    </p>
  )
}

function isEmpty(children: ReactNode) {
  return children === null || children === undefined || children === false || children === ''
}

export function SpeechBubble({
  children,
  className,
  tail = 'left',
  live = false,
  ref,
  tabIndex,
}: {
  children?: ReactNode
  className?: string
  tail?: 'left' | 'bottom' | 'none'
  /**
   * Announce changes politely (feedback bubbles, WCAG 4.1.3). VoiceOver on iOS ignores live
   * regions that are inserted already filled, so render a live bubble unconditionally and swap
   * only its content: with nothing to say it stays mounted as an empty, visually hidden region.
   */
  live?: boolean
  ref?: Ref<HTMLDivElement>
  /** `-1` lets the caller move focus here — the result of a control that just went away. */
  tabIndex?: number
}) {
  const empty = isEmpty(children)
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
      className={cn(
        empty
          ? 'sr-only'
          : 'relative rounded-[1.5rem] border-[3px] border-dashed border-kid-primary/45 bg-kid-surface px-5 py-4 text-lg font-semibold text-kid-fg',
        tabIndex !== undefined && 'kid-focus',
        !empty && className,
      )}
    >
      {!empty && tail === 'left' && (
        <span
          aria-hidden="true"
          className="absolute top-6 -left-3 size-5 rotate-45 border-b-[3px] border-l-[3px] border-dashed border-kid-primary/45 bg-kid-surface"
        />
      )}
      {!empty && tail === 'bottom' && (
        <span
          aria-hidden="true"
          className="absolute -bottom-3 left-10 size-5 rotate-45 border-r-[3px] border-b-[3px] border-dashed border-kid-primary/45 bg-kid-surface"
        />
      )}
      {!empty && <span className="relative">{children}</span>}
    </div>
  )
}

/** Circular progress with the value in the middle. */
export function ProgressRing({
  value,
  label,
  size = 64,
  className,
  children,
}: {
  /** 0–1 */
  value: number
  label: string
  size?: number
  className?: string
  children?: ReactNode
}) {
  const ratio = Math.min(1, Math.max(0, value))
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- circular SVG ring with a centred value; native <progress> cannot render it
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-kid-surface-2"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-kid-accent transition-[stroke-dashoffset] duration-700 ease-out-quart"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span className="relative text-sm font-bold text-kid-fg tabular">
        {children ?? `${Math.round(ratio * 100)}%`}
      </span>
    </div>
  )
}

/**
 * Pause/play for looping or long animations (WCAG 2.2.2). The label names the action ("Oynat" /
 * "Durdur"), so there is no `aria-pressed` — a changing label plus a pressed state would
 * contradict each other (WCAG 4.1.2).
 */
export function MotionToggle({
  paused,
  onToggle,
  className,
}: {
  paused: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'kid-focus inline-flex h-12 items-center gap-2 rounded-full bg-kid-surface/95 px-4 text-base font-semibold text-kid-fg shadow-kid-soft',
        'transition-transform duration-150 active:scale-95',
        className,
      )}
    >
      <span aria-hidden="true">{paused ? '▶️' : '⏸️'}</span>
      {paused ? 'Oynat' : 'Durdur'}
    </button>
  )
}
