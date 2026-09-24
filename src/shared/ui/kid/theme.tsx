import { useMemo, useState, type ReactNode } from 'react'

import { KidThemeContext, type KidTheme } from './useKidTheme'

/** Holds the active kit theme for the Kâşif layout (see `useApplyKidTheme`). */
export function KidThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<KidTheme | null>(null)
  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <KidThemeContext.Provider value={value}>{children}</KidThemeContext.Provider>
}
