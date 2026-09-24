import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'

import type { KitDocument } from '@/entities/kit'
import { kitProgressSummary, track, useExplorerProgress } from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { KitIcon } from '@/features/kit-player'
import { KidPanel, Mascot, useApplyKidTheme, useCelebrate } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'
import { KitLoader } from './components/KitLoader'

const linkClass =
  'kid-focus inline-flex min-h-16 items-center justify-center gap-2 rounded-[1.375rem] px-6 text-xl font-bold transition-transform active:translate-y-1'

function Complete({ kit }: { kit: KitDocument }) {
  const { explorer } = useActiveExplorer()
  const { progress, isPending } = useExplorerProgress(explorer?.id)
  const celebrate = useCelebrate()
  const reported = useRef(false)
  useApplyKidTheme(kit.theme)
  const row = progress.get(kit.id)
  const summary = kitProgressSummary(kit, row)

  // R13: "Bitirdim!" — report completion once (the server keeps the first completion time).
  useEffect(() => {
    if (!explorer || isPending || !summary.done || reported.current) return
    reported.current = true
    celebrate(`${kit.badge.emoji} ${kit.badge.name} rozetini kazandın!`)
    if (!row?.completedAt) {
      track({
        type: 'kit_complete',
        explorerId: explorer.id,
        kitId: kit.id,
        stepId: null,
        data: { durationMs: row?.totalDurationMs ?? 0 },
      })
    }
  }, [celebrate, explorer, isPending, kit, row, summary.done])

  if (!explorer) return null
  const remaining = kit.steps.filter(
    (step) => step.required && !summary.completedStepIds.has(step.id),
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2 text-center">
      <title>{`${kit.title} tamamlandı · Kâşif`}</title>
      <KidsTopBar
        back={{ to: `/kit/${kit.slug}`, label: 'Kitin kartlarına dön' }}
        explorer={explorer}
      />
      {summary.done ? (
        <>
          <Mascot
            color={explorer.avatar}
            pose="celebrate"
            className="kid-ambient mx-auto size-40 [animation:kid-float_3s_ease-in-out_infinite]"
          />
          <h1 className="text-[clamp(2rem,7vw,2.8rem)] leading-tight font-bold">
            Tebrikler {explorer.nickname}!
          </h1>
          <p className="text-xl text-kid-fg-soft">
            “{kit.title}” kitinin tüm kartlarını tamamladın.
          </p>
          <KidPanel className="flex flex-col items-center gap-2">
            <span
              data-card-color={kit.badge.color}
              className="kid-color-card grid size-28 place-items-center rounded-full text-6xl"
              aria-hidden="true"
            >
              {kit.badge.emoji}
            </span>
            <p className="text-2xl font-bold">{kit.badge.name}</p>
            <p className="text-lg text-kid-fg-soft">{kit.badge.description}</p>
          </KidPanel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to={`/sertifika/${kit.slug}`}
              className={`${linkClass} flex-1 bg-kid-accent text-kid-accent-fg shadow-kid-3d-accent`}
            >
              📜 Sertifikamı gör
            </Link>
            <Link
              to="/"
              className={`${linkClass} flex-1 bg-kid-surface text-kid-fg shadow-kid-soft ring-2 ring-kid-border`}
            >
              🏠 Bilim Merkezi
            </Link>
          </div>
        </>
      ) : (
        <>
          <Mascot color={explorer.avatar} pose="thinking" className="mx-auto size-32" />
          <h1 className="text-3xl font-bold">Az kaldı!</h1>
          <p className="text-xl text-kid-fg-soft">Kiti bitirmek için şu kartları tamamla:</p>
          <ul className="flex flex-col gap-3 text-left">
            {remaining.map((step) => (
              <li key={step.id}>
                <Link
                  to={`/kit/${kit.slug}/${step.slug}`}
                  data-card-color={step.cardColor}
                  className="kid-focus kid-color-card flex min-h-16 items-center gap-3 rounded-[1.25rem] px-5 text-xl font-bold"
                >
                  <KitIcon icon={step.icon} className="text-3xl" />
                  {step.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function KitCompletePage() {
  const { kitSlug = '' } = useParams()
  return <KitLoader slug={kitSlug}>{(kit) => <Complete kit={kit} />}</KitLoader>
}
