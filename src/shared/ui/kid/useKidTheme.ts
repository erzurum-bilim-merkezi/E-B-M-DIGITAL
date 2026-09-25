import { createContext, useContext, useEffect } from 'react'

/**
 * Kit theme applied to the Kâşif root element (sky tint, accent, font, motion level). Pages
 * showing a kit call `useApplyKidTheme(kit.theme)`; the layout reads it with `useKidTheme()`.
 * CSS custom properties must live on the `.kasif` element itself, hence a context and not a
 * wrapper div.
 */
export type KidTheme = {
  preset?: string | undefined
  accent?: string | undefined
  font?: 'playful' | 'standard' | undefined
  motion?: 'full' | 'calm' | 'minimal' | undefined
}

type ThemeState = { theme: KidTheme | null; setTheme: (theme: KidTheme | null) => void }

export const KidThemeContext = createContext<ThemeState>({ theme: null, setTheme: () => {} })

export function useKidTheme() {
  return useContext(KidThemeContext).theme
}

export function useApplyKidTheme(theme: KidTheme | null | undefined) {
  const { setTheme } = useContext(KidThemeContext)
  const active = Boolean(theme)
  const preset = theme?.preset
  const accent = theme?.accent
  const font = theme?.font
  const motion = theme?.motion
  useEffect(() => {
    if (!active) return
    setTheme({ preset, accent, font, motion })
    return () => setTheme(null)
  }, [active, preset, accent, font, motion, setTheme])
}
