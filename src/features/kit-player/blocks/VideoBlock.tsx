import { useState } from 'react'

import { HintText, KidPanel, SpeechBubble } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { VisualArea } from '../visuals/VisualArea'
import { useCompleteOnce, type BlockProps } from './types'

/** Video card: YouTube completes with "İzledim", MP4 at 80 % watched. */
export function VideoBlock({ step, onComplete }: BlockProps<'video'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [watched, setWatched] = useState(false)

  const onWatched = () => {
    setWatched(true)
    if (complete()) celebrate(step.celebration || '🎬 Harika!')
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="p-3">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state="play"
            title={step.title}
            cardColor={step.cardColor}
            onVideoWatched={onWatched}
            videoWatched={watched}
          />
        ) : (
          <p className="p-6 text-center text-lg text-kid-fg-soft">Bu kartta henüz video yok.</p>
        )}
      </KidPanel>
      {step.caption && <HintText>{step.caption}</HintText>}
      {/* Mounted before the video is watched (empty) so screen readers announce the question. */}
      <SpeechBubble tail="none" live>
        {watched && step.questionAfter ? `🤔 ${step.questionAfter}` : null}
      </SpeechBubble>
    </div>
  )
}
