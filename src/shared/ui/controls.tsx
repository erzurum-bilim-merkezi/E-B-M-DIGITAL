import { Check, Minus } from 'lucide-react'
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Switch as SwitchPrimitive,
  Tabs as TabsPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
} from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-150',
        'bg-control-border disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-white shadow-xs transition-transform duration-150 ease-out-quart data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'grid size-[1.125rem] shrink-0 cursor-pointer place-items-center rounded-[5px] bg-surface shadow-xs ring-1 ring-control-border ring-inset',
        'data-[state=checked]:bg-primary data-[state=checked]:ring-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-danger',
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-primary-fg">
        {props.checked === 'indeterminate' ? (
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Checkbox with its label and optional help text. */
export function CheckboxField({
  label,
  description,
  id,
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & {
  label: ReactNode
  description?: ReactNode
  id: string
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Checkbox
        id={id}
        className="mt-0.5"
        aria-describedby={description ? `${id}-help` : undefined}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <p id={`${id}-help`} className="text-xs text-fg-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

export const RadioGroup = RadioPrimitive.Root

export function RadioItem({
  label,
  description,
  id,
  className,
  ...props
}: ComponentProps<typeof RadioPrimitive.Item> & {
  label: ReactNode
  description?: ReactNode
  id: string
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <RadioPrimitive.Item
        id={id}
        className={cn(
          'mt-0.5 grid size-[1.125rem] shrink-0 cursor-pointer place-items-center rounded-full bg-surface shadow-xs ring-1 ring-control-border ring-inset',
          'data-[state=checked]:ring-[5px] data-[state=checked]:ring-primary',
          focusRing,
        )}
        aria-describedby={description ? `${id}-help` : undefined}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <p id={`${id}-help`} className="text-xs text-fg-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-fg-muted',
        'transition-colors duration-150 hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg',
        'rounded-t-md [&_svg]:size-4',
        focusRing,
        className,
      )}
      {...props}
    />
  )
}

/** Compact single-choice toggle (view switches, ranges). Wraps onto more rows when narrow. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly { value: T; label: ReactNode; icon?: ReactNode }[]
  label: string
  className?: string
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next)
        if (option) onValueChange(option.value)
      }}
      aria-label={label}
      className={cn(
        'inline-flex max-w-full flex-wrap rounded-md bg-surface-muted p-0.5 ring-1 ring-border ring-inset',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-[5px] px-3 text-sm font-medium text-fg-muted transition-colors [&_svg]:size-4',
            'hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-xs',
            focusRing,
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
