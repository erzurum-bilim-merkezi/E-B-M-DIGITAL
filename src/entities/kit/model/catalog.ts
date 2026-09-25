import { z } from 'zod'

import { iconSchema } from './icons.ts'
import { badgeSchema, kitCategorySchema, themeSchema } from './kit.ts'
import {
  isoDateTimeSchema,
  mediaRefSchema,
  qrCodeSchema,
  qrPrefixSchema,
  slugSchema,
  stepIdSchema,
} from './primitives.ts'

/**
 * Published snapshot files (read by the Kâşif app, never by the database):
 *   catalog.json · qr-index.json · kits/{slug}/latest.json · kits/{slug}/v{n}.json
 */
export const catalogEntrySchema = z.object({
  id: z.uuid(),
  slug: slugSchema,
  version: z.int().positive(),
  title: z.string().max(60),
  tagline: z.string().max(120),
  icon: iconSchema,
  cover: mediaRefSchema.optional(),
  category: kitCategorySchema,
  ageRange: z.object({ min: z.int(), max: z.int() }),
  durationMinutes: z.int(),
  theme: themeSchema,
  stepCount: z.int().nonnegative(),
  badge: badgeSchema,
  qrPrefix: qrPrefixSchema,
  publishedAt: isoDateTimeSchema,
})
export type CatalogEntry = z.infer<typeof catalogEntrySchema>

export const catalogSchema = z.object({
  generatedAt: isoDateTimeSchema,
  generation: z.int().nonnegative(),
  /** Older installed apps refresh themselves when they are below this version (ADR 0019). */
  minAppVersion: z.int().positive(),
  kits: z.array(catalogEntrySchema),
})
export type Catalog = z.infer<typeof catalogSchema>

export const qrIndexEntrySchema = z.object({
  kitId: z.uuid(),
  kitSlug: slugSchema,
  /** `null` for the kit code itself (`KC`). */
  stepId: stepIdSchema.nullable(),
  stepSlug: z.string().nullable(),
  /** Codes are never deleted or reused; removed cards and archived kits turn inactive. */
  active: z.boolean(),
  /** `published` | `archived` — lets the app explain why a code does not open. */
  kitState: z.enum(['published', 'archived']),
})
export type QrIndexEntry = z.infer<typeof qrIndexEntrySchema>

export const qrIndexSchema = z.object({
  generatedAt: isoDateTimeSchema,
  codes: z.record(qrCodeSchema, qrIndexEntrySchema),
})
export type QrIndex = z.infer<typeof qrIndexSchema>

export const latestPointerSchema = z.object({
  version: z.int().positive(),
  publishedAt: isoDateTimeSchema,
})
export type LatestPointer = z.infer<typeof latestPointerSchema>
