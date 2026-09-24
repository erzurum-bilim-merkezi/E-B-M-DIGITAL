import { useId } from 'react'

import type { Explorer, ExplorerSettings } from '@/entities/explorer'
import { cn } from '@/shared/lib/cn'
import { KidPanel } from '@/shared/ui/kid'

import { useUpdateExplorer } from '../api/queries'

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col">
        <label id={`${id}-l`} htmlFor={id} className="text-xl font-semibold">
          {label}
        </label>
        <p id={`${id}-d`} className="text-base text-kid-fg-soft">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={`${id}-d`}
        onClick={() => onChange(!checked)}
        // Off: outlined track with a dark thumb; on: filled track with a light thumb. Track and
        // thumb keep ≥ 3:1 against the panel and each other in both themes (WCAG 1.4.11).
        className={cn(
          'kid-focus relative h-10 w-[4.25rem] shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-kid-success' : 'bg-kid-surface-2 ring-2 ring-kid-control-border',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1 left-1 size-8 rounded-full shadow-kid-soft transition-transform duration-200 ease-out-quart',
            checked ? 'translate-x-7 bg-kid-surface' : 'bg-kid-control-border',
          )}
        />
      </button>
    </div>
  )
}

/** Sound, motion and text size — stored on the membership (follows the child to any device). */
export function ProfileSettings({ explorer }: { explorer: Explorer }) {
  const update = useUpdateExplorer()
  const save = (patch: Partial<ExplorerSettings>) =>
    update.mutate({ id: explorer.id, patch: { settings: { ...explorer.settings, ...patch } } })

  return (
    <KidPanel as="section" aria-labelledby="settings-title" className="flex flex-col">
      <h2 id="settings-title" className="mb-1 text-2xl font-bold">
        ⚙️ Ayarlar
      </h2>
      <div className="divide-y-2 divide-kid-border">
        <Toggle
          label="🔊 Sesler"
          description="“Dinle” butonu kartları sesli okur."
          checked={explorer.settings.sound}
          onChange={(sound) => save({ sound })}
        />
        <Toggle
          label="🐢 Animasyonları azalt"
          description="Hareketli sahneler durur, konfeti çıkmaz."
          checked={explorer.settings.reduceMotion}
          onChange={(reduceMotion) => save({ reduceMotion })}
        />
        <Toggle
          label="🔠 Büyük yazı"
          description="Yazılar daha büyük görünür."
          checked={explorer.settings.textSize === 'large'}
          onChange={(large) => save({ textSize: large ? 'large' : 'normal' })}
        />
      </div>
    </KidPanel>
  )
}
