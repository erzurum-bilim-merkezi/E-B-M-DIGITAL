import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import {
  getStepBySlug,
  getStepIndex,
  nextUnfinishedStep,
  requiredStepIds,
  type KitDocument,
} from '@/entities/kit'
import { track, useKitCompletion } from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { PlayerProvider, StepShell, type PlayerEnvironment } from '@/features/kit-player'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { KidPanel, Mascot, useApplyKidTheme, useCelebrate } from '@/shared/ui/kid'

import { KitLoader } from './components/KitLoader'

function StepView({ kit }: { kit: KitDocument }) {
  const { stepSlug = '' } = useParams()
  const [params] = useSearchParams()
  const { explorer } = useActiveExplorer()
  // The card that finishes the kit reports it — focused-mode kits never pass the menu (R13).
  const { summary } = useKitCompletion(kit, explorer?.id)
  const celebrate = useCelebrate()
  const osReduced = usePrefersReducedMotion()
  // Render stays pure: the mount time is read once (lazy initial state), then kept in a ref.
  const [mountedAt] = useState(() => Date.now())
  const startedAt = useRef(mountedAt)
  useApplyKidTheme(kit.theme)

  const step = getStepBySlug(kit, stepSlug)
  const stepId = step?.id

  // card_open once per card view; the timer measures time-to-complete. Keyed by the explorer's
  // id: a refetched explorer object (every event batch updates lastSeenAt) is the same visit.
  const explorerId = explorer?.id
  useEffect(() => {
    if (!explorerId || !stepId) return
    // oxlint-disable-next-line react/purity -- false positive: this runs in an effect, not during render
    startedAt.current = Date.now()
    track({ type: 'card_open', explorerId, kitId: kit.id, stepId, data: {} })
  }, [explorerId, kit.id, stepId])

  const environment = useMemo<PlayerEnvironment>(
    () => ({
      reducedMotion:
        osReduced || (explorer?.settings.reduceMotion ?? false) || kit.theme.motion === 'minimal',
      motion: kit.theme.motion,
      muted: !(explorer?.settings.sound ?? true),
      celebrate,
      mode: 'kids',
    }),
    [
      celebrate,
      explorer?.settings.reduceMotion,
      explorer?.settings.sound,
      kit.theme.motion,
      osReduced,
    ],
  )

  if (!explorer) return null
  if (!step) {
    return (
      <KidPanel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 text-center">
        <title>Kart bulunamadı · Kâşif</title>
        <Mascot pose="thinking" className="size-28" />
        <h1 className="text-2xl font-bold">Bu kart bulunamadı</h1>
        <Link
          to={`/kit/${kit.slug}`}
          className="kid-focus rounded-lg text-lg font-semibold text-kid-link underline underline-offset-4"
        >
          🗂️ Kitin kartlarına dön
        </Link>
      </KidPanel>
    )
  }

  const index = getStepIndex(kit, step.id)
  const done = summary.completedStepIds
  // Unfinished cards first, wrapping around: a child who started from a QR in the middle of the
  // kit still reaches the cards before it.
  const next = nextUnfinishedStep(kit, step.id, done)
  const required = requiredStepIds(kit)
  // R2: a QR scan in "focused" kits shows only this card (E-B-M direct entry).
  const focused = params.get('giris') === 'qr' && kit.qrEntryMode === 'focused'
  const base = `/kit/${kit.slug}`

  return (
    <PlayerProvider value={environment}>
      <title>{`${step.title} · ${kit.title} · Kâşif`}</title>
      <StepShell
        kit={kit}
        step={step}
        index={index}
        focused={focused}
        completed={done.has(step.id)}
        kitDone={summary.done}
        progress={{ done: required.filter((id) => done.has(id)).length, total: required.length }}
        nav={{
          home: { to: base },
          next: next ? { to: `${base}/${next.slug}` } : undefined,
          finish: { to: `${base}/tamamlandi` },
          allCards: { to: base },
          scanNext: { to: '/qr-okut' },
        }}
        onStepComplete={({ attempts }) =>
          track({
            type: 'card_complete',
            explorerId: explorer.id,
            kitId: kit.id,
            stepId: step.id,
            data: { durationMs: Math.min(6 * 3600_000, Date.now() - startedAt.current), attempts },
          })
        }
        onQuizAnswer={({ correct, optionId }) =>
          track({
            type: 'quiz_answer',
            explorerId: explorer.id,
            kitId: kit.id,
            stepId: step.id,
            data: { correct, optionId },
          })
        }
      />
    </PlayerProvider>
  )
}

export function StepPage() {
  const { kitSlug = '' } = useParams()
  return <KitLoader slug={kitSlug}>{(kit) => <StepView kit={kit} />}</KitLoader>
}
