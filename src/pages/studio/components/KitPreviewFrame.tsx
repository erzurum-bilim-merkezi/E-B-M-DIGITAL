import { useMemo, useState } from 'react'

import type { KitDocument } from '@/entities/kit'
import type { ResolvedAsset } from '@/features/studio-kits'
import {
  KitIcon,
  PlayerProvider,
  SceneView,
  StepShell,
  type PlayerEnvironment,
} from '@/features/kit-player'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { cn } from '@/shared/lib/cn'
import { CelebrationProvider, useCelebrate } from '@/shared/ui/kid'

import { useResolvedDraft } from './useResolvedDraft'

function PreviewStep({
  kit,
  stepId,
  onNavigate,
}: {
  kit: KitDocument
  stepId: string
  onNavigate: (stepId: string | null) => void
}) {
  const celebrate = useCelebrate()
  const reducedMotion = usePrefersReducedMotion()
  const index = kit.steps.findIndex((step) => step.id === stepId)
  const step = kit.steps[index]
  const environment = useMemo<PlayerEnvironment>(
    () => ({
      reducedMotion: reducedMotion || kit.theme.motion === 'minimal',
      motion: kit.theme.motion,
      muted: false,
      celebrate,
      mode: 'preview',
    }),
    [celebrate, kit.theme.motion, reducedMotion],
  )
  if (!step) return null
  const next = kit.steps[index + 1]
  return (
    <PlayerProvider value={environment}>
      <StepShell
        kit={kit}
        step={step}
        index={index}
        focused={false}
        completed={false}
        autoFocus={false}
        nav={{
          home: { onClick: () => onNavigate(null) },
          next: next ? { onClick: () => onNavigate(next.id) } : undefined,
          finish: { onClick: () => celebrate(`${kit.badge.emoji} ${kit.badge.name} rozeti!`) },
          allCards: { onClick: () => onNavigate(null) },
        }}
        onStepComplete={() => undefined}
      />
    </PlayerProvider>
  )
}

function PreviewHome({ kit, onOpen }: { kit: KitDocument; onOpen: (stepId: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <KitIcon icon={kit.icon} className="text-5xl" />
        <p className="text-2xl font-bold">{kit.title || 'Adsız kit'}</p>
        {kit.tagline && <p className="text-base text-kid-fg-soft">{kit.tagline}</p>}
      </div>
      <ol className="grid grid-cols-2 gap-3">
        {kit.steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              data-card-color={step.cardColor}
              onClick={() => onOpen(step.id)}
              className="kid-focus kid-color-card flex min-h-32 w-full flex-col items-center justify-center gap-1.5 rounded-[1.5rem] p-3 text-center"
            >
              <KitIcon icon={step.icon} className="text-3xl" />
              <span className="text-sm leading-tight font-bold">{step.title || 'Adsız kart'}</span>
              <span className="rounded-full bg-white/25 px-2.5 text-xs font-bold">{index + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Live Kâşif preview inside Studio (F8.7): the real player on the resolved draft, no activity
 * tracking, navigation stays inside the frame.
 */
export function KitPreviewFrame({
  kit,
  stepId,
  device,
  fullHeight = false,
}: {
  kit: KitDocument
  stepId: string | null
  device: 'phone' | 'tablet'
  fullHeight?: boolean
}) {
  const [current, setCurrent] = useState<string | null>(stepId)
  const [syncedStep, setSyncedStep] = useState(stepId)
  if (stepId !== syncedStep) {
    setSyncedStep(stepId)
    setCurrent(stepId)
  }
  return (
    <div
      className={cn(
        'mx-auto overflow-hidden rounded-[2rem] border-[10px] border-fg/85 bg-fg/85 shadow-lg',
        device === 'phone' ? 'w-full max-w-[390px]' : 'w-full max-w-[820px]',
      )}
    >
      <div
        className={cn(
          'kasif isolate overflow-y-auto rounded-[1.4rem] px-3 py-4',
          fullHeight ? 'h-[calc(100dvh-10rem)]' : device === 'phone' ? 'h-[680px]' : 'h-[760px]',
        )}
        data-kit-theme={kit.theme.preset}
        data-font={kit.theme.font}
        data-motion={kit.theme.motion}
        style={kit.theme.accent ? { '--kit-accent-custom': kit.theme.accent } : undefined}
        data-testid="kit-preview"
      >
        <CelebrationProvider reduceMotion={kit.theme.motion === 'minimal'}>
          {current && kit.steps.some((step) => step.id === current) ? (
            <PreviewStep kit={kit} stepId={current} onNavigate={setCurrent} />
          ) : (
            <PreviewHome kit={kit} onOpen={setCurrent} />
          )}
        </CelebrationProvider>
      </div>
    </div>
  )
}

/** Preview of an unpublished draft: asset ids are resolved to URLs first (editor side panel). */
export function ResolvedPreview({
  kit,
  stepId,
  device,
  assets,
}: {
  kit: KitDocument
  stepId: string | null
  device: 'phone' | 'tablet'
  assets: ReadonlyMap<string, ResolvedAsset>
}) {
  const resolved = useResolvedDraft(kit, assets)
  return <KitPreviewFrame kit={resolved} stepId={stepId} device={device} />
}

export function SceneThumb({
  sceneId,
  state,
  title,
}: {
  sceneId: Parameters<typeof SceneView>[0]['sceneId']
  state: string
  title: string
}) {
  return <SceneView sceneId={sceneId} state={state} paused reducedMotion title={title} />
}
