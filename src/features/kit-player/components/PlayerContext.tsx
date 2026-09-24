import type { ReactNode } from 'react'

import { PlayerContext, type PlayerEnvironment } from './usePlayer'

export type { PlayerEnvironment } from './usePlayer'

export function PlayerProvider({
  value,
  children,
}: {
  value: PlayerEnvironment
  children: ReactNode
}) {
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}
