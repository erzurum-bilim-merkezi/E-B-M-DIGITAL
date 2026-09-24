import { useState, type ReactNode } from 'react'

import type { Visual } from '@/entities/kit'
import { cn } from '@/shared/lib/cn'
import { MotionToggle } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { SceneView } from '../scenes/registry'
import { AiSceneImage } from './AiSceneImage'
import { isAnimatedVisual } from './is-animated-visual'
import { MediaImage } from './MediaImage'
import { VideoPlayer } from './VideoPlayer'

type VisualAreaProps = {
  visual: Visual
  /** Scene state driven by the block (ignored for images and video). */
  state: string
  title: string
  cardColor: string
  /** Emoji for the generic emoji stage (stage emoji or card icon). */
  emoji?: string | undefined
  /** Controlled pause (animated-scene shows a different caption while paused). */
  paused?: boolean
  onPausedChange?: (paused: boolean) => void
  onVideoWatched?: () => void
  videoWatched?: boolean
  /** Extra overlay inside the stage (e.g. the tap target). */
  children?: ReactNode
  className?: string
}

/**
 * The card's visual slot: library scene (inline React SVG), AI scene (<img> per state), image
 * or linked video. Looping animations get a visible pause control (WCAG 2.2.2).
 */
export function VisualArea({
  visual,
  state,
  title,
  cardColor,
  emoji,
  paused: controlledPaused,
  onPausedChange,
  onVideoWatched,
  videoWatched = false,
  children,
  className,
}: VisualAreaProps) {
  const { reducedMotion, motion } = usePlayer()
  const [ownPaused, setOwnPaused] = useState(false)
  const paused = controlledPaused ?? ownPaused
  const setPaused = onPausedChange ?? setOwnPaused
  const animated = isAnimatedVisual(visual)
  const stillMotion = reducedMotion || motion === 'minimal'

  if (visual.kind === 'video') {
    return (
      <VideoPlayer
        source={visual.source}
        title={title}
        cardColor={cardColor}
        onWatched={() => onVideoWatched?.()}
        watched={videoWatched}
      />
    )
  }

  return (
    <div className={cn('relative', className)}>
      {visual.kind === 'scene' && (
        <SceneView
          sceneId={visual.sceneId}
          state={state}
          paused={paused || stillMotion}
          reducedMotion={stillMotion}
          title={title}
          emoji={emoji}
        />
      )}
      {visual.kind === 'ai-scene' && (
        <AiSceneImage visual={visual} state={state} paused={paused || stillMotion} />
      )}
      {visual.kind === 'image' && (
        <MediaImage url={visual.media.url} alt={visual.media.alt ?? title} />
      )}
      {children}
      {animated && !stillMotion && (
        <MotionToggle
          paused={paused}
          onToggle={() => setPaused(!paused)}
          className="absolute right-3 bottom-3"
        />
      )}
    </div>
  )
}
