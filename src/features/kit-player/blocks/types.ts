import { useCallback, useRef } from 'react'

import type { BlockType, StepOf } from '@/entities/kit'

export type BlockCompletion = { attempts: number }

/** Player contract (F5.5): blocks know nothing about progress, activity or routing. */
export type BlockProps<T extends BlockType> = {
  step: StepOf<T>
  /** Called exactly once, when the block's completion rule is met. */
  onComplete: (meta: BlockCompletion) => void
  /** Quiz answers (correct or not) for analytics. */
  onQuizAnswer?: ((answer: { correct: boolean; optionId: string }) => void) | undefined
}

/** Wraps `onComplete` so it fires once per mount, whatever the block does. */
export function useCompleteOnce(onComplete: (meta: BlockCompletion) => void) {
  const done = useRef(false)
  return useCallback(
    (meta: BlockCompletion = { attempts: 1 }) => {
      if (done.current) return false
      done.current = true
      onComplete(meta)
      return true
    },
    [onComplete],
  )
}
