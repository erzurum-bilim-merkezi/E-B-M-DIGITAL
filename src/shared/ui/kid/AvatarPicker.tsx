import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

import { Mascot } from './Mascot'
import { MASCOT_COLORS, type MascotColor } from './mascot-palettes'

type AvatarPickerProps = {
  value: MascotColor
  onChange: (value: MascotColor) => void
  labels: Record<MascotColor, string>
  legend: string
  className?: string
}

/** Six mascot avatars as a native radio group (arrow keys, screen readers, 72 px targets). */
export function AvatarPicker({ value, onChange, labels, legend, className }: AvatarPickerProps) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {MASCOT_COLORS.map((color) => {
          const id = `${name}-${color}`
          const selected = value === color
          return (
            <div key={color} className="relative">
              <input
                id={id}
                type="radio"
                name={name}
                value={color}
                checked={selected}
                onChange={() => onChange(color)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-[1.5rem] bg-kid-surface p-2 shadow-kid-soft ring-4 ring-transparent',
                  'transition-[transform,box-shadow] duration-150 ease-out-quart hover:-translate-y-0.5',
                  'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-kid-focus',
                  selected && 'ring-kid-primary',
                )}
              >
                <Mascot
                  color={color}
                  pose={selected ? 'hello' : 'idle'}
                  className="size-20 sm:size-24"
                />
                <span className="sr-only">{labels[color]}</span>
              </label>
              {selected && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-kid-success text-base text-white shadow-kid-soft"
                >
                  ✓
                </span>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
