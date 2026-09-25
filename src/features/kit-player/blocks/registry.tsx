import type { BlockType, Step } from '@/entities/kit'

import { ChooseCorrectBlock, CompareCardsBlock, QuizBlock } from './ChoiceBlocks'
import { ExperimentBlock } from './ExperimentBlock'
import { MatchingBlock, SequenceBlock } from './PuzzleBlocks'
import {
  AnimatedSceneBlock,
  ExploreHotspotsBlock,
  InfoBlock,
  StageSliderBlock,
  TapRevealBlock,
  ToggleSceneBlock,
} from './SceneBlocks'
import type { BlockProps } from './types'
import { VideoBlock } from './VideoBlock'

type RenderProps = Omit<BlockProps<BlockType>, 'step'> & { step: Step }

/** Narrows the step union to its block component without casts. */
export function StepRenderer({ step, ...props }: RenderProps) {
  switch (step.type) {
    case 'info':
      return <InfoBlock step={step} {...props} />
    case 'tap-reveal':
      return <TapRevealBlock step={step} {...props} />
    case 'stage-slider':
      return <StageSliderBlock step={step} {...props} />
    case 'explore-hotspots':
      return <ExploreHotspotsBlock step={step} {...props} />
    case 'toggle-scene':
      return <ToggleSceneBlock step={step} {...props} />
    case 'animated-scene':
      return <AnimatedSceneBlock step={step} {...props} />
    case 'choose-correct':
      return <ChooseCorrectBlock step={step} {...props} />
    case 'compare-cards':
      return <CompareCardsBlock step={step} {...props} />
    case 'quiz':
      return <QuizBlock step={step} {...props} />
    case 'sequence':
      return <SequenceBlock step={step} {...props} />
    case 'matching':
      return <MatchingBlock step={step} {...props} />
    case 'experiment':
      return <ExperimentBlock step={step} {...props} />
    case 'video':
      return <VideoBlock step={step} {...props} />
  }
}
