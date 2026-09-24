import { createContext, useContext } from 'react'

export type PlayerEnvironment = {
  /** OS reduced motion, explorer setting or kit motion "minimal". */
  reducedMotion: boolean
  /** Kit motion level ("sakin" pauses ambient loops). */
  motion: 'full' | 'calm' | 'minimal'
  /** Explorer turned sounds off. */
  muted: boolean
  celebrate: (message?: string) => void
  /** `preview` = Studio preview (no tracking, no navigation away). */
  mode: 'kids' | 'preview'
}

export const PlayerContext = createContext<PlayerEnvironment>({
  reducedMotion: false,
  motion: 'full',
  muted: false,
  celebrate: () => {},
  mode: 'kids',
})

export function usePlayer() {
  return useContext(PlayerContext)
}
