import { z } from 'zod'

import { createStoredValue } from '@/shared/hooks/stored-value'

/**
 * Studio → Ayarlar → "Bu cihazda Kâşif'i önizle" (ADR 0013). On a preview device the Kâşif app
 * skips the coming-soon page and marks every event `isPreview` (kept out of statistics,
 * deleted after 24 h). Not a security boundary — published content is public anyway.
 */
export const previewDevice = createStoredValue('kasif:preview:v1', z.boolean(), false)
