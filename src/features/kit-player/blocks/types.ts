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

/** The card icon as the emoji stage's emoji (library and uploaded icons fall back to ✨). */
export function iconEmoji(step: { icon: { kind: string; value?: string } }) {
  return step.icon.kind === 'emoji' && step.icon.value ? step.icon.value : undefined
}

const NBSP = String.fromCharCode(0xa0)

/**
 * Next text for a live region (WCAG 4.1.3): when it equals the current text, a trailing
 * no-break space is toggled so the region's content still changes and is read out again.
 */
export function reannounce(previous: string | null, next: string) {
  return previous === next ? next + NBSP : next
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
