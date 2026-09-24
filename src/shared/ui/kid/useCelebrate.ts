import { createContext, useContext } from 'react'

export type CelebrateFn = (message?: string) => void

export const CelebrationContext = createContext<CelebrateFn>(() => {})

/** Confetti + cheer bubble of the nearest `CelebrationProvider`. */
export function useCelebrate() {
  return useContext(CelebrationContext)
}
