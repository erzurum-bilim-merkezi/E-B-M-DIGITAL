import type { ComponentType } from 'react'

import type { BlockType } from '@/entities/kit'

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

type BlockRegistry = { [K in BlockType]: ComponentType<BlockProps<K>> }

/** Every block type must have a player component (checked by `satisfies`). */
export const BLOCK_COMPONENTS = {
  info: InfoBlock,
  'tap-reveal': TapRevealBlock,
  'stage-slider': StageSliderBlock,
  'explore-hotspots': ExploreHotspotsBlock,
  'toggle-scene': ToggleSceneBlock,
  'animated-scene': AnimatedSceneBlock,
  'choose-correct': ChooseCorrectBlock,
  'compare-cards': CompareCardsBlock,
  quiz: QuizBlock,
  sequence: SequenceBlock,
  matching: MatchingBlock,
  experiment: ExperimentBlock,
  video: VideoBlock,
} satisfies BlockRegistry
