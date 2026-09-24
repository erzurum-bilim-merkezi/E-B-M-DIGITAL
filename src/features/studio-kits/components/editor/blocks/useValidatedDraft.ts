import { useState } from 'react'

/**
 * Text the user is typing into a field whose stored value must stay structurally valid (drafts
 * are schema-checked on save, e.g. an emoji can't be empty). Valid input is committed on every
 * keystroke; invalid input stays visible with an error and is not committed. A value changed
 * from outside (undo, reorder, AI) replaces the local text.
 */
export function useValidatedDraft(
  value: string,
  isValid: (candidate: string) => boolean,
  commit: (next: string) => void,
) {
  const [draft, setDraft] = useState(value)
  const [committed, setCommitted] = useState(value)
  if (committed !== value) {
    // Adjusting state while rendering (not in an effect) avoids a stale frame.
    setCommitted(value)
    setDraft(value)
  }

  const change = (next: string) => {
    setDraft(next)
    if (!isValid(next)) return
    setCommitted(next)
    commit(next)
  }

  return { draft, change, valid: isValid(draft) }
}
