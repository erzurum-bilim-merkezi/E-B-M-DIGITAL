import { Info } from 'lucide-react'
import type { ComponentType } from 'react'

import { BLOCK_CATALOG, type BlockType, type Step } from '@/entities/kit'

import { ChooseCorrectEditor, CompareCardsEditor, QuizEditor } from './ChoiceEditors'
import { ExperimentEditor } from './ExperimentEditor'
import { MatchingEditor, SequenceEditor } from './PuzzleEditors'
import {
  AnimatedSceneEditor,
  ExploreHotspotsEditor,
  InfoEditor,
  StageSliderEditor,
  TapRevealEditor,
  ToggleSceneEditor,
} from './SceneEditors'
import type { BlockEditorProps } from './types'
import { VideoEditor } from './VideoEditor'

type BlockEditorRegistry = { [K in BlockType]: ComponentType<BlockEditorProps<K>> }

/** Every block type must have a fields editor (checked by `satisfies`). */
// oxlint-disable-next-line react/only-export-components -- the registry is this module's contract, like kit-player's BLOCK_COMPONENTS
export const BLOCK_EDITORS = {
  info: InfoEditor,
  'tap-reveal': TapRevealEditor,
  'stage-slider': StageSliderEditor,
  'explore-hotspots': ExploreHotspotsEditor,
  'toggle-scene': ToggleSceneEditor,
  'animated-scene': AnimatedSceneEditor,
  'choose-correct': ChooseCorrectEditor,
  'compare-cards': CompareCardsEditor,
  quiz: QuizEditor,
  sequence: SequenceEditor,
  matching: MatchingEditor,
  experiment: ExperimentEditor,
  video: VideoEditor,
} satisfies BlockEditorRegistry

type BlockFieldsEditorProps = {
  step: Step
  onChange: (next: Step) => void
  issueFor: (field: string) => string | undefined
}

/** The block-specific fields of a card; narrows the step union to its editor without casts. */
export function BlockFieldsEditor({ step, onChange, issueFor }: BlockFieldsEditorProps) {
  switch (step.type) {
    case 'info':
      return <InfoEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'tap-reveal':
      return <TapRevealEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'stage-slider':
      return <StageSliderEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'explore-hotspots':
      return <ExploreHotspotsEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'toggle-scene':
      return <ToggleSceneEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'animated-scene':
      return <AnimatedSceneEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'choose-correct':
      return <ChooseCorrectEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'compare-cards':
      return <CompareCardsEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'quiz':
      return <QuizEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'sequence':
      return <SequenceEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'matching':
      return <MatchingEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'experiment':
      return <ExperimentEditor step={step} onChange={onChange} issueFor={issueFor} />
    case 'video':
      return <VideoEditor step={step} onChange={onChange} issueFor={issueFor} />
    default: {
      // A new block type fails to compile here until it gets an editor.
      const unhandled: never = step
      return unhandled
    }
  }
}

/** What the block does, when it completes and which E-B-M card it comes from. */
export function BlockHelp({ type }: { type: BlockType }) {
  const meta = BLOCK_CATALOG[type]
  return (
    <div
      role="note"
      className="flex gap-3 rounded-lg bg-surface-muted p-3.5 text-sm ring-1 ring-border ring-inset"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="leading-relaxed text-fg">{meta.description}</p>
        <dl className="flex flex-col gap-1 text-xs">
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium text-fg-muted">Tamamlanma:</dt>
            <dd className="text-fg">{meta.completion}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium text-fg-muted">E-B-M’deki karşılığı:</dt>
            <dd className="text-fg">{meta.referenceHint}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
