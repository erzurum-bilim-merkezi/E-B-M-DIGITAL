import { z } from 'zod'

/** Step slugs that collide with fixed kit routes (`/kit/:kitSlug/tamamlandi`). */
export const RESERVED_STEP_SLUGS: readonly string[] = ['tamamlandi']

export const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Yalnızca küçük harf, rakam ve tire kullanılabilir')

export const stepSlugSchema = slugSchema.refine(
  (slug) => !RESERVED_STEP_SLUGS.includes(slug),
  'Bu adres uygulama tarafından kullanılıyor',
)

/** Stable step identity: progress, events and QR codes point at it, so it never changes. */
export const stepIdSchema = z.string().regex(/^[a-z0-9-]{2,40}$/)

export const qrPrefixSchema = z.string().regex(/^[A-Z]{2,4}$/, '2–4 büyük harf (ör. KC)')
/** Card code (`KC-01`) — printed on equipment labels. */
export const cardQrCodeSchema = z.string().regex(/^[A-Z]{2,4}-\d{2,3}$/)
/** Kit code (`KC`) or card code (`KC-01`). */
export const qrCodeSchema = z.string().regex(/^[A-Z]{2,4}(?:-\d{2,3})?$/)

export const CARD_COLORS = [
  'green',
  'lime',
  'orange',
  'yellow',
  'sky',
  'purple',
  'pink',
  'indigo',
] as const
export const cardColorSchema = z.enum(CARD_COLORS)
export type CardColor = z.infer<typeof cardColorSchema>

/** One emoji (clusters like 👩‍🍳 are several code points). */
export const emojiSchema = z
  .string()
  .min(1)
  .max(16)
  .regex(/^[^\s]+$/u, 'Tek bir emoji seçin')

/**
 * URLs a published snapshot may carry. Only https (Supabase Storage, video sources) and the
 * mock backend's blob store — never `javascript:`/`data:` so content can't smuggle markup.
 */
export function isSafeMediaUrl(url: string) {
  return /^(?:https:\/\/[^\s]+|mock-media:[0-9a-f-]{36})$/i.test(url)
}

export const safeMediaUrlSchema = z
  .string()
  .max(2048)
  .refine(isSafeMediaUrl, 'Yalnızca https bağlantıları kullanılabilir')

/**
 * Reference to an uploaded asset. Drafts store only `assetId`; publishing resolves `url`
 * (and `alt` for images) into the immutable snapshot.
 */
export const mediaRefSchema = z.object({
  assetId: z.uuid(),
  url: safeMediaUrlSchema.optional(),
  alt: z.string().max(200).optional(),
})
export type MediaRef = z.infer<typeof mediaRefSchema>

/** `**bold**` and line breaks only — rendered as React nodes, never as HTML. */
export const richTextSchema = z.string().max(2000)

export const isoDateTimeSchema = z.iso.datetime({ offset: true })
