import type { BlockType, StepOf } from '@/entities/kit'

/**
 * Block-specific fields editor (the common card fields and the visual slot are edited by
 * StepEditor). `issueFor(field)` returns the first publish-validation error for that field key
 * (same keys as `validateKitForPublish`: 'stages', 'hotspots', 'options', 'question' …).
 */
export type BlockEditorProps<T extends BlockType> = {
  step: StepOf<T>
  onChange: (next: StepOf<T>) => void
  issueFor: (field: string) => string | undefined
}
