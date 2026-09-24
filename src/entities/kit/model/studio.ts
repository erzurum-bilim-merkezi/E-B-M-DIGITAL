import { z } from 'zod'

import { kitDocumentSchema } from './kit.ts'
import {
  isoDateTimeSchema,
  qrCodeSchema,
  qrPrefixSchema,
  slugSchema,
  stepIdSchema,
} from './primitives.ts'

/**
 * Editorial state of a kit's working copy (`kits.status`):
 *   draft      — being edited (may also be a live kit with unpublished changes)
 *   in_review  — an editor submitted it; locked for editors until published or sent back
 *   published  — working copy equals the live version
 *   archived   — removed from the catalog; its QR codes explain that it is no longer live
 * Whether a kit is live is `publishedVersion !== null && status !== 'archived'`.
 */
export const KIT_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const
export const kitStatusSchema = z.enum(KIT_STATUSES)
export type KitStatus = z.infer<typeof kitStatusSchema>

/** `unlisted` = not in the catalog, still reachable by link and QR — not secret. */
export const kitVisibilitySchema = z.enum(['public', 'unlisted'])
export type KitVisibility = z.infer<typeof kitVisibilitySchema>

export const studioKitSchema = z.object({
  id: z.uuid(),
  slug: slugSchema,
  qrPrefix: qrPrefixSchema,
  status: kitStatusSchema,
  visibility: kitVisibilitySchema,
  draft: kitDocumentSchema,
  publishedVersion: z.int().positive().nullable(),
  firstPublishedAt: isoDateTimeSchema.nullable(),
  lastPublishedAt: isoDateTimeSchema.nullable(),
  /** Admin's "Değişiklik iste" note for the editor. */
  reviewNote: z.string().max(1000).nullable(),
  /** Lock version the editor submitted; publishing an in-review kit uses exactly this state. */
  reviewedLockVersion: z.int().nullable(),
  /** Optimistic concurrency token — every save must send the version it started from. */
  lockVersion: z.int().nonnegative(),
  /** Lock version that was last published (unpublished changes = lockVersion > this). */
  publishedLockVersion: z.int().nullable(),
  ownerId: z.uuid(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  updatedBy: z.uuid(),
})
export type StudioKit = z.infer<typeof studioKitSchema>

export function isKitLive(kit: Pick<StudioKit, 'publishedVersion' | 'status'>) {
  return kit.publishedVersion !== null && kit.status !== 'archived'
}

export function hasUnpublishedChanges(
  kit: Pick<StudioKit, 'publishedLockVersion' | 'lockVersion' | 'publishedVersion'>,
) {
  return kit.publishedVersion !== null && kit.publishedLockVersion !== kit.lockVersion
}

/** Slug and QR prefix are printed and linked — they freeze after the first publish. */
export function canRenameKit(kit: Pick<StudioKit, 'firstPublishedAt'>) {
  return kit.firstPublishedAt === null
}

/** Only never-published kits can be deleted (their QR codes were never printed live). */
export function canDeleteKit(kit: Pick<StudioKit, 'firstPublishedAt'>) {
  return kit.firstPublishedAt === null
}

export const kitVersionSchema = z.object({
  kitId: z.uuid(),
  version: z.int().positive(),
  document: kitDocumentSchema,
  notes: z.string().max(500),
  publishedBy: z.uuid(),
  publishedAt: isoDateTimeSchema,
  aiReviewConfirmed: z.boolean(),
  /** Set once the snapshot files are written and the kit row points at this version. */
  finalizedAt: isoDateTimeSchema.nullable(),
  /** Lock version of the draft that was published (retries reuse the same version number). */
  sourceLockVersion: z.int().nonnegative(),
})
export type KitVersion = z.infer<typeof kitVersionSchema>

/** QR registry row — never deleted, never reused. */
export const qrCodeRowSchema = z.object({
  code: qrCodeSchema,
  kitId: z.uuid(),
  stepId: stepIdSchema.nullable(),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
})
export type QrCodeRow = z.infer<typeof qrCodeRowSchema>

export const KIT_STATUS_LABELS: Record<KitStatus, string> = {
  draft: 'Taslak',
  in_review: 'İncelemede',
  published: 'Yayında',
  archived: 'Arşivde',
}

/** Status shown on dashboards, combining editorial state and liveness. */
export function describeKitState(
  kit: Pick<StudioKit, 'status' | 'publishedVersion' | 'publishedLockVersion' | 'lockVersion'>,
) {
  if (kit.status === 'archived') return { label: 'Arşivde', tone: 'neutral' as const }
  if (kit.publishedVersion === null) {
    return kit.status === 'in_review'
      ? { label: 'İncelemede', tone: 'warning' as const }
      : { label: 'Taslak', tone: 'info' as const }
  }
  if (kit.status === 'in_review') return { label: 'Yayında · incelemede', tone: 'warning' as const }
  if (hasUnpublishedChanges(kit))
    return { label: 'Yayında · değişiklik var', tone: 'primary' as const }
  return { label: 'Yayında', tone: 'success' as const }
}
