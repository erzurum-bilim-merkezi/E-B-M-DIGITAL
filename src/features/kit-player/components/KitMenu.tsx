import { Link } from 'react-router'

import { KIT_CATEGORY_LABELS, type CatalogEntry, type KitDocument } from '@/entities/kit'
import { cn } from '@/shared/lib/cn'
import { RichText } from '@/shared/ui'
import { ProgressRing } from '@/shared/ui/kid'

import { KitIcon } from './KitIcon'

/** Kit header: big icon, title, tagline and the explorer's progress ring. */
export function KitHero({
  kit,
  ratio,
  completedCount,
}: {
  kit: KitDocument
  ratio: number
  completedCount: number
}) {
  return (
    <header className="flex flex-col items-center gap-3 pt-2 text-center">
      <KitIcon
        icon={kit.icon}
        className="kid-ambient [animation:kid-sway_3s_ease-in-out_infinite] text-[clamp(3.4rem,14vw,5rem)]"
      />
      <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none font-bold tracking-tight text-balance">
        {kit.title}
      </h1>
      {kit.tagline && (
        <p className="max-w-xl text-[clamp(1rem,4vw,1.25rem)] font-medium text-kid-fg-soft">
          {kit.tagline}
        </p>
      )}
      <div className="mt-1 flex items-center gap-3 rounded-full bg-kid-surface py-2 pr-5 pl-2 shadow-kid-soft">
        <ProgressRing value={ratio} label="Kit ilerlemesi" size={52}>
          {completedCount}
        </ProgressRing>
        <span className="text-base font-semibold text-kid-fg-soft">
          {completedCount} / {kit.steps.length} kart tamamlandı
        </span>
      </div>
    </header>
  )
}

/** R1: colored card menu — one big card per question, ✓ when done. */
export function KitMenu({
  kit,
  completed,
  stepHref,
}: {
  kit: KitDocument
  completed: ReadonlySet<string>
  stepHref: (slug: string) => string
}) {
  return (
    <ol className="grid grid-cols-2 gap-3.5 sm:grid-cols-3" aria-label="Kartlar">
      {kit.steps.map((step, index) => {
        const done = completed.has(step.id)
        const lastOdd = index === kit.steps.length - 1 && kit.steps.length % 2 === 1
        return (
          <li key={step.id} className={cn('grid', lastOdd && 'col-span-2 sm:col-span-1')}>
            <Link
              to={stepHref(step.slug)}
              data-card-color={step.cardColor}
              className="kid-focus kid-color-card relative flex min-h-40 flex-col items-center justify-center gap-2 rounded-[1.625rem] px-3 pt-5 pb-4 text-center transition-transform duration-150 active:scale-[0.96]"
            >
              <KitIcon
                icon={step.icon}
                className="text-[2.6rem] drop-shadow-[0_3px_3px_rgb(0_0_0/0.18)]"
              />
              <span className="text-[clamp(1rem,3.8vw,1.15rem)] leading-tight font-bold text-balance">
                {step.title}
              </span>
              <span className="rounded-full bg-white/25 px-3 py-0.5 text-sm font-bold tabular">
                {index + 1}
              </span>
              {done && (
                <span
                  className="absolute -top-2 -right-2 grid size-9 place-items-center rounded-full bg-kid-surface text-lg shadow-kid-soft"
                  aria-label="tamamlandı"
                >
                  ✅
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** Kit tile for the Science Centre (catalog entry). */
export function KitTile({
  entry,
  href,
  ratio,
}: {
  entry: CatalogEntry
  href: string
  ratio: number
}) {
  return (
    <Link
      to={href}
      className="kid-focus group relative flex h-full flex-col gap-3 overflow-hidden rounded-[1.75rem] bg-kid-surface p-5 shadow-kid-card transition-transform duration-200 ease-out-quart hover:-translate-y-1 active:scale-[0.98]"
      data-kit-theme={entry.theme.preset}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-16 place-items-center rounded-[1.25rem] bg-kid-surface-2 text-4xl">
          <KitIcon icon={entry.icon} />
        </span>
        <ProgressRing value={ratio} label={`${entry.title} ilerlemesi`} size={48} />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl leading-tight font-bold">{entry.title}</h2>
        {entry.tagline && (
          <p className="text-base font-medium text-kid-fg-soft">
            <RichText text={entry.tagline} />
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 text-sm font-semibold text-kid-fg-soft">
        <span className="rounded-full bg-kid-surface-2 px-3 py-1">
          {KIT_CATEGORY_LABELS[entry.category]}
        </span>
        <span className="rounded-full bg-kid-surface-2 px-3 py-1">
          {entry.ageRange.min}–{entry.ageRange.max} yaş
        </span>
        <span className="rounded-full bg-kid-surface-2 px-3 py-1">{entry.stepCount} kart</span>
      </div>
    </Link>
  )
}
