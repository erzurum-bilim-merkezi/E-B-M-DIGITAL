import { z } from 'zod'

import { createStoredValue } from '@/shared/hooks/stored-value'

/** Studio appearance: follow the OS or force light/dark (per device). */
export const studioTheme = createStoredValue(
  'kasif:studio-theme',
  z.enum(['system', 'light', 'dark']),
  'system',
)

export function useStudioTheme() {
  return studioTheme.useValue()
}
