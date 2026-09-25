import { z } from 'zod'

import {
  buildCatalog,
  buildQrIndex,
  collectMediaAssetIds,
  createKitFromTemplate,
  hasBlockingIssues,
  kitDocumentSchema,
  kitUsesAi,
  kitVersionSchema,
  latestVersionOf,
  qrCodeRowSchema,
  resolveKitMedia,
  studioKitSchema,
  validateKitForPublish,
  type KitDocument,
  type KitVersion,
} from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import {
  isAlreadyExists,
  isRangeNotSatisfiable,
  mediaObjectUrl,
  readAll,
  staffClient,
  toAppError,
  unwrap,
} from '@/shared/api/supabase'

import { duplicateDraft, duplicateIdentity, kitQrCodes, withPrefix } from './kit-logic'
import type { KitRepository, PublishingService, PublishValidationDetails, QrRegistry } from './port'

/*
 * Kits on Supabase. Drafts are built with the shared TypeScript model and saved through RPCs
 * that guard identity, lock versions and permissions. Publishing is a resumable saga run by the
 * admin's Studio (ADR 0021): lease → reserve version → immutable v<n>.json in the `published`
 * bucket → finalize → catalog.json, qr-index.json and latest.json rebuilt from the database.
 */

const KIT_COLUMNS =
  'id, slug, qrPrefix:qr_prefix, status, visibility, draft, publishedVersion:published_version, firstPublishedAt:first_published_at, lastPublishedAt:last_published_at, reviewNote:review_note, reviewedLockVersion:reviewed_lock_version, lockVersion:lock_version, publishedLockVersion:published_lock_version, ownerId:owner_id, createdAt:created_at, updatedAt:updated_at, updatedBy:updated_by'
const VERSION_COLUMNS =
  'kitId:kit_id, version, document, notes, publishedBy:published_by, publishedAt:published_at, aiReviewConfirmed:ai_review_confirmed, finalizedAt:finalized_at, sourceLockVersion:source_lock_version'
const QR_COLUMNS = 'code, kitId:kit_id, stepId:step_id, active, createdAt:created_at'

const kitList = z.array(studioKitSchema)
const versionList = z.array(kitVersionSchema)
const publishedSchema = z.object({ kit: studioKitSchema, version: kitVersionSchema })

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return unwrap(await staffClient().rpc(name, args))
}

async function kitRpc(name: string, args: Record<string, unknown>) {
  return studioKitSchema.parse(await rpc(name, args))
}

async function getKit(id: string) {
  const row = unwrap(
    await staffClient().from('kits').select(KIT_COLUMNS).eq('id', id).maybeSingle(),
  )
  if (!row) throw new AppError('not_found', 'Kit bulunamadı.')
  return studioKitSchema.parse(row)
}

/** Every kit, paged by id: a draft saved between two pages must not move a kit to a read page. */
async function allKits() {
  const rows = await readAll((from, to) =>
    staffClient().from('kits').select(KIT_COLUMNS).order('id').range(from, to),
  )
  return kitList.parse(rows)
}

/** Parses a draft the way the mock does before saving it. */
function parseDraft(draft: KitDocument, message: string) {
  const parsed = kitDocumentSchema.safeParse(draft)
  if (!parsed.success) throw new AppError('validation', message)
  return parsed.data
}

// --- Storage (published bucket) ------------------------------------------------------------

const IMMUTABLE = '31536000'

/**
 * Changing files (indexes, latest.json) are revalidated on every read; version files never
 * change and are cached for a year (ADR 0020). Versions are written once, except when a restore
 * from backup rewrites them (`overwrite`).
 */
async function writeJson(
  path: string,
  value: unknown,
  options: { immutable?: boolean; overwrite?: boolean } = {},
) {
  const immutable = options.immutable ?? false
  const overwrite = options.overwrite ?? !immutable
  // A string body goes out as-is with Content-Type and Cache-Control headers.
  const { error } = await staffClient()
    .storage.from('published')
    .upload(path, JSON.stringify(value), {
      contentType: 'application/json',
      cacheControl: immutable ? IMMUTABLE : '0',
      upsert: overwrite,
    })
  return error
}

async function removeFile(path: string) {
  const { error } = await staffClient().storage.from('published').remove([path])
  return error
}

/** v<n>.json is written once; an identical file from an interrupted run counts as written. */
async function writeSnapshot(slug: string, version: KitVersion) {
  const path = `kits/${slug}/v${version.version}.json`
  const error = await writeJson(path, version.document, { immutable: true })
  if (!error) return
  // Only "already there" is compared; any other failure (offline, permission) is itself.
  if (!isAlreadyExists(error)) throw toAppError(error)
  const download = await staffClient().storage.from('published').download(path)
  // Not being able to read it back is retryable; only different content is a conflict.
  if (download.error) throw toAppError(download.error)
  // Both sides through the schema: key order is the schema's, whichever app version wrote it.
  const existing = kitDocumentSchema.safeParse(JSON.parse(await download.data.text()))
  const written = kitDocumentSchema.parse(version.document)
  if (!existing.success || JSON.stringify(existing.data) !== JSON.stringify(written)) {
    throw new AppError(
      'conflict',
      'Bu sürümün dosyası farklı içerikle zaten var. Yöneticiye haber verin.',
    )
  }
}

async function finalizedVersions() {
  const rows = await readAll((from, to) =>
    staffClient()
      .from('kit_versions')
      .select(VERSION_COLUMNS)
      .not('finalized_at', 'is', null)
      .order('kit_id')
      .order('version')
      .range(from, to),
  )
  return versionList.parse(rows)
}

async function allQrCodes() {
  const rows = await readAll((from, to) =>
    staffClient().from('qr_codes').select(QR_COLUMNS).order('code').range(from, to),
  )
  return z.array(qrCodeRowSchema).parse(rows)
}

/**
 * Rebuilds the public indexes from the database (never patched, ADR 0019). If another publish
 * changed the generation meanwhile, it rebuilds again.
 */
async function regenerateIndexes() {
  for (let attempt = 0; attempt < 3; attempt++) {
    // oxlint-disable-next-line no-await-in-loop -- one pass after another until nothing changed
    const generation = z.coerce.number().parse(await rpc('publish_generation'))
    // oxlint-disable-next-line no-await-in-loop -- see above
    const [kits, versions, qrRows] = await Promise.all([
      allKits(),
      finalizedVersions(),
      allQrCodes(),
    ])
    const now = new Date().toISOString()
    const writes = [
      writeJson('catalog.json', buildCatalog(kits, versions, generation, now)),
      writeJson('qr-index.json', buildQrIndex(kits, versions, qrRows, now)),
      ...kits.flatMap((kit) => {
        const latest = latestVersionOf(kit.id, versions)
        if (!latest) return []
        const path = `kits/${latest.document.slug}/latest.json`
        // An archived kit no longer opens by its address (its QR codes say it is archived).
        return kit.status === 'archived'
          ? [removeFile(path)]
          : [writeJson(path, { version: latest.version, publishedAt: latest.publishedAt })]
      }),
    ]
    // oxlint-disable-next-line no-await-in-loop -- see above
    const failed = (await Promise.all(writes)).find((error) => error !== null)
    if (failed) throw new AppError('unavailable', 'Yayın dosyaları yazılamadı. Tekrar deneyin.')
    // oxlint-disable-next-line no-await-in-loop -- see above
    if (z.coerce.number().parse(await rpc('publish_generation')) === generation) return
  }
}

/** Runs `work` holding the publish lease (one publish at a time). */
async function withLease<T>(work: () => Promise<T>) {
  const holder = crypto.randomUUID()
  if (!(await rpc('publish_acquire_lease', { p_holder: holder }))) {
    throw new AppError('conflict', 'Başka bir yayın sürüyor. Birkaç saniye sonra tekrar deneyin.')
  }
  try {
    return await work()
  } finally {
    await staffClient()
      .rpc('publish_release_lease', { p_holder: holder })
      .then(
        () => undefined,
        () => undefined,
      )
  }
}

/** Media ids of the draft → public URL and alt text (drafts store ids only). */
async function mediaResolver(document: KitDocument) {
  const ids = [...collectMediaAssetIds(document)]
  if (ids.length === 0) return () => undefined
  const rows = z
    .array(z.object({ id: z.uuid(), kind: z.string(), path: z.string(), alt: z.string() }))
    .parse(
      unwrap(await staffClient().from('media_assets').select('id, kind, path, alt').in('id', ids)),
    )
  const assets = new Map(
    rows.map((row) => [row.id, { url: mediaObjectUrl(row.kind, row.path), alt: row.alt }]),
  )
  return (assetId: string) => assets.get(assetId)
}

// --- Adapters --------------------------------------------------------------------------------

async function listKits(
  filter: Parameters<KitRepository['list']>[0],
): ReturnType<KitRepository['list']> {
  let query = staffClient()
    .from('kits')
    .select(KIT_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false })
  if (filter.status !== 'all') query = query.eq('status', filter.status)
  const needle = filter.query
    .trim()
    .replace(/[%,()*]/g, ' ')
    .trim()
  if (needle) {
    // Prefixes are ASCII A–Z (exact); titles and addresses match anywhere.
    query = query.or(
      `draft->>title.ilike.*${needle}*,slug.ilike.*${needle}*,qr_prefix.eq.${needle.toUpperCase()}`,
    )
  }
  const from = (Math.max(1, filter.page) - 1) * filter.pageSize
  const { data, error, count } = await query.order('id').range(from, from + filter.pageSize - 1)
  // The page no longer exists (kits were deleted meanwhile): go to the last one there is.
  if (isRangeNotSatisfiable(error) && filter.page > 1) {
    const first = await listKits({ ...filter, page: 1 })
    return first.pageCount > 1 ? listKits({ ...filter, page: first.pageCount }) : first
  }
  const items = kitList.parse(unwrap({ data, error }))
  const total = count ?? items.length
  const pageCount = Math.max(1, Math.ceil(total / filter.pageSize))
  // Past the last page (a kit was deleted meanwhile): show the last page instead.
  if (filter.page > pageCount && total > 0) return listKits({ ...filter, page: pageCount })
  return { items, total, page: Math.min(Math.max(1, filter.page), pageCount), pageCount }
}

export function createSupabaseKitRepository(): KitRepository {
  return {
    list: listKits,

    listAll: allKits,

    get: getKit,

    async create(input) {
      const id = crypto.randomUUID()
      const draft = input.document
        ? withPrefix({ ...input.document, id, slug: input.slug, version: 0 }, input.qrPrefix)
        : createKitFromTemplate(input.templateId, {
            id,
            title: input.title.trim(),
            slug: input.slug,
            qrPrefix: input.qrPrefix,
            tagline: input.tagline,
            description: input.description,
            category: input.category,
            ageRange: input.ageRange,
            durationMinutes: input.durationMinutes,
            icon: input.icon,
          })
      return kitRpc('kit_create', {
        p_id: id,
        p_slug: input.slug,
        p_qr_prefix: input.qrPrefix,
        p_draft: parseDraft(draft, 'Kit taslağı geçersiz.'),
      })
    },

    async update(id, draft, lockVersion) {
      return kitRpc('kit_save_draft', {
        p_kit: id,
        p_draft: parseDraft(draft, 'Taslak kaydedilemedi: yapı geçersiz.'),
        p_lock_version: lockVersion,
      })
    },

    async rename(id, slug, qrPrefix, lockVersion) {
      const kit = await getKit(id)
      return kitRpc('kit_rename', {
        p_kit: id,
        p_slug: slug,
        p_qr_prefix: qrPrefix,
        p_draft: withPrefix({ ...kit.draft, slug }, qrPrefix),
        p_lock_version: lockVersion,
      })
    },

    async duplicate(id) {
      const [source, kits, prefixes] = await Promise.all([
        getKit(id),
        allKits(),
        rpc('kit_taken_prefixes').then((value) => z.array(z.string()).parse(value)),
      ])
      const identity = duplicateIdentity(
        source,
        new Set(kits.map((kit) => kit.slug)),
        new Set(prefixes),
      )
      const kitId = crypto.randomUUID()
      return kitRpc('kit_create', {
        p_id: kitId,
        p_slug: identity.slug,
        p_qr_prefix: identity.qrPrefix,
        p_draft: duplicateDraft(source, { id: kitId, ...identity }),
        p_duplicate_of: id,
      })
    },

    async remove(id) {
      await rpc('kit_delete', { p_kit: id })
    },

    async checkAvailability(slug, qrPrefix, exceptId) {
      return z.object({ slugTaken: z.boolean(), prefixTaken: z.boolean() }).parse(
        await rpc('kit_identity_taken', {
          p_slug: slug,
          p_qr_prefix: qrPrefix,
          p_except: exceptId ?? null,
        }),
      )
    },

    async listTakenPrefixes() {
      return z.array(z.string()).parse(await rpc('kit_taken_prefixes'))
    },
  }
}

export function createSupabasePublishingService(): PublishingService {
  return {
    submitForReview: (kitId, lockVersion) =>
      kitRpc('kit_submit_for_review', { p_kit: kitId, p_lock_version: lockVersion }),

    withdrawReview: (kitId) => kitRpc('kit_withdraw_review', { p_kit: kitId }),

    requestChanges: (kitId, note) => kitRpc('kit_request_changes', { p_kit: kitId, p_note: note }),

    async publish(kitId, input) {
      return withLease(async () => {
        const kit = await getKit(kitId)
        if (kit.status === 'archived') {
          throw new AppError('conflict', 'Arşivdeki kit yayınlanamaz. Önce arşivden çıkarın.')
        }
        if (kit.lockVersion !== input.lockVersion) {
          throw new AppError(
            'conflict',
            'Kit bu arada değişti. Son hâlini gözden geçirip tekrar yayınlayın.',
            { latest: kit },
          )
        }
        const issues = validateKitForPublish(kit.draft)
        const { kit: resolved, missing } = resolveKitMedia(
          kit.draft,
          await mediaResolver(kit.draft),
        )
        if (hasBlockingIssues(issues) || missing.length > 0) {
          const details: PublishValidationDetails = {
            issues: issues.filter((issue) => issue.severity === 'error'),
            missingAssets: missing,
          }
          throw new AppError(
            'validation',
            'Yayından önce düzeltilmesi gereken sorunlar var.',
            details,
          )
        }
        if (kitUsesAi(kit.draft) && !input.aiReviewConfirmed) {
          throw new AppError('validation', 'Yapay zekâ içeriğini kontrol ettiğinizi onaylayın.')
        }

        const reserved = kitVersionSchema.parse(
          await rpc('publish_reserve_version', {
            p_kit: kitId,
            p_lock_version: input.lockVersion,
            p_document: resolved,
            p_notes: input.notes,
            p_ai_review_confirmed: input.aiReviewConfirmed,
          }),
        )
        await writeSnapshot(kit.slug, reserved)
        const result = publishedSchema.parse(
          await rpc('publish_finalize', {
            p_kit: kitId,
            p_version: reserved.version,
            p_visibility: input.visibility,
          }),
        )
        await regenerateIndexes()
        return result
      })
    },

    setVisibility: (kitId, visibility) =>
      withLease(async () => {
        const kit = await kitRpc('kit_set_visibility', { p_kit: kitId, p_visibility: visibility })
        await regenerateIndexes()
        return kit
      }),

    archive: (kitId) =>
      withLease(async () => {
        const kit = await kitRpc('kit_archive', { p_kit: kitId })
        await regenerateIndexes()
        return kit
      }),

    unarchive: (kitId) =>
      withLease(async () => {
        const kit = await kitRpc('kit_unarchive', { p_kit: kitId })
        await regenerateIndexes()
        return kit
      }),

    async listVersions(kitId) {
      const rows = unwrap(
        await staffClient()
          .from('kit_versions')
          .select(VERSION_COLUMNS)
          .eq('kit_id', kitId)
          .not('finalized_at', 'is', null)
          .order('version', { ascending: false }),
      )
      return versionList.parse(rows)
    },

    restoreToDraft: (kitId, version, lockVersion) =>
      kitRpc('kit_restore_version', {
        p_kit: kitId,
        p_version: version,
        p_lock_version: lockVersion,
      }),

    regenerateSnapshots: () =>
      withLease(async () => {
        const [versions, kits] = await Promise.all([finalizedVersions(), allKits()])
        const slugs = new Map(kits.map((kit) => [kit.id, kit.slug]))
        // A restore from backup: rewrite every snapshot file (same content = overwrite is safe).
        const failed = (
          await Promise.all(
            versions.map((version) =>
              writeJson(
                `kits/${slugs.get(version.kitId) ?? version.document.slug}/v${version.version}.json`,
                version.document,
                { immutable: true, overwrite: true },
              ),
            ),
          )
        ).find((error) => error !== null)
        if (failed) throw new AppError('unavailable', 'Yayın dosyaları yazılamadı. Tekrar deneyin.')
        await rpc('publish_log_regenerated')
        await regenerateIndexes()
      }),
  }
}

export function createSupabaseQrRegistry(): QrRegistry {
  return {
    async listForKit(kitId) {
      const [kit, versions, qrRows] = await Promise.all([
        getKit(kitId),
        staffClient()
          .from('kit_versions')
          .select(VERSION_COLUMNS)
          .eq('kit_id', kitId)
          .not('finalized_at', 'is', null)
          .then((result) => versionList.parse(unwrap(result))),
        staffClient()
          .from('qr_codes')
          .select(QR_COLUMNS)
          .eq('kit_id', kitId)
          .then((result) => z.array(qrCodeRowSchema).parse(unwrap(result))),
      ])
      return kitQrCodes(kit, versions, qrRows)
    },
  }
}
