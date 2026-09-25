import { z } from 'zod'

import {
  buildCatalog,
  buildQrIndex,
  canDeleteKit,
  canRenameKit,
  catalogSchema,
  createKitFromTemplate,
  formatCardCode,
  isoDateTimeSchema,
  kitDocumentSchema,
  kitUsesAi,
  kitVersionSchema,
  latestPointerSchema,
  latestVersionOf,
  qrCodeRowSchema,
  qrIndexSchema,
  qrPrefixSchema,
  resolveKitMedia,
  slugifyTr,
  slugSchema,
  studioKitSchema,
  syncQrRows,
  uniqueSlug,
  validateKitForPublish,
  hasBlockingIssues,
  type KitDocument,
  type KitVersion,
  type StudioKit,
} from '@/entities/kit'
import { mediaAssetSchema } from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockDoc, mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_DOCS, MOCK_TABLES } from '@/shared/api/mock-tables'

import type {
  KitQrCode,
  KitRepository,
  PublishingService,
  PublishValidationDetails,
  QrRegistry,
} from './port'

export const kitsTable = mockTable(MOCK_TABLES.kits, studioKitSchema)
export const versionsTable = mockTable(MOCK_TABLES.kitVersions, kitVersionSchema)
export const qrTable = mockTable(MOCK_TABLES.qrCodes, qrCodeRowSchema)
/**
 * `qr_prefix_reservations`: every prefix a kit ever held, written on create, rename (the old
 * prefix too) and delete. Staff may print labels before the first publish, so a prefix is never
 * handed to another kit — not even after its kit was renamed or deleted.
 */
const prefixReservationsTable = mockTable(
  MOCK_TABLES.qrPrefixReservations,
  z.object({ prefix: qrPrefixSchema, kitId: z.uuid(), reservedAt: isoDateTimeSchema }),
)
const mediaTable = mockTable(MOCK_TABLES.mediaAssets, mediaAssetSchema)
const publishState = mockDoc(
  MOCK_DOCS.publishState,
  z.object({ generation: z.int().nonnegative() }),
)
const catalogDoc = mockDoc(MOCK_DOCS.catalog, catalogSchema)
const qrIndexDoc = mockDoc(MOCK_DOCS.qrIndex, qrIndexSchema)

const DRAFT_AUDIT_INTERVAL_MS = 60 * 60 * 1000
const lastDraftAudit = new Map<string, number>()

function now() {
  return new Date().toISOString()
}

function getKit(id: string) {
  const kit = kitsTable.find((row) => row.id === id)
  if (!kit) throw new AppError('not_found', 'Kit bulunamadı.')
  return kit
}

function saveKit(kit: StudioKit) {
  kitsTable.update(
    (row) => row.id === kit.id,
    () => kit,
  )
  return kit
}

/** Rebuild every published index from the database — never patch (ADR 0019). */
function regenerate() {
  const generation = (publishState.get()?.generation ?? 0) + 1
  const timestamp = now()
  const kits = kitsTable.all()
  const versions = versionsTable.all()
  catalogDoc.set(buildCatalog(kits, versions, generation, timestamp))
  qrIndexDoc.set(buildQrIndex(kits, versions, qrTable.all(), timestamp))
  for (const kit of kits) {
    const latest = latestVersionOf(kit.id, versions)
    if (latest) {
      mockDoc(MOCK_DOCS.latest(latest.document.slug), latestPointerSchema).set({
        version: latest.version,
        publishedAt: latest.publishedAt,
      })
    }
  }
  publishState.set({ generation })
}

function assertEditable(kit: StudioKit, role: 'admin' | 'editor') {
  if (kit.status === 'archived') {
    throw new AppError('conflict', 'Arşivdeki kit düzenlenemez. Önce arşivden çıkarın.')
  }
  if (role === 'editor' && kit.status === 'in_review') {
    throw new AppError(
      'forbidden',
      'İncelemedeki kit kilitli. Düzenlemek için incelemeden geri çekin.',
    )
  }
}

/**
 * Prefixes held by kits other than `exceptId`: in use, in the QR registry, or reserved by a
 * rename or delete. Printed codes must never point at another kit.
 */
function prefixesHeldByOthers(exceptId?: string) {
  return new Set([
    ...kitsTable.filter((row) => row.id !== exceptId).map((row) => row.qrPrefix),
    ...qrTable.filter((row) => row.kitId !== exceptId).map((row) => row.code.split('-')[0] ?? ''),
    ...prefixReservationsTable.filter((row) => row.kitId !== exceptId).map((row) => row.prefix),
  ])
}

/** Records that `kitId` holds (or held) `prefix`; the first holder keeps it forever. */
function reservePrefix(prefix: string, kitId: string) {
  if (prefixReservationsTable.find((row) => row.prefix === prefix)) return
  prefixReservationsTable.insert({ prefix, kitId, reservedAt: now() })
}

function ensureUnique(slug: string, qrPrefix: string, exceptId?: string) {
  return {
    slugTaken: kitsTable.filter((row) => row.id !== exceptId).some((row) => row.slug === slug),
    prefixTaken: prefixesHeldByOthers(exceptId).has(qrPrefix),
  }
}

function validateIdentity(slug: string, qrPrefix: string, exceptId?: string) {
  if (!slugSchema.safeParse(slug).success)
    throw new AppError('validation', 'Adres yalnızca küçük harf, rakam ve tire içerebilir.')
  if (!qrPrefixSchema.safeParse(qrPrefix).success)
    throw new AppError('validation', 'QR öneki 2–4 büyük harf olmalı.')
  const { slugTaken, prefixTaken } = ensureUnique(slug, qrPrefix, exceptId)
  if (slugTaken) throw new AppError('conflict', 'Bu adres başka bir kitte kullanılıyor.')
  if (prefixTaken)
    throw new AppError(
      'conflict',
      'Bu QR öneki kullanılmış. Basılı kodlar karışmasın diye başka bir önek seçin.',
    )
}

function withPrefix(document: KitDocument, qrPrefix: string): KitDocument {
  return {
    ...document,
    qrPrefix,
    steps: document.steps.map((step) => ({
      ...step,
      qrCode: formatCardCode(qrPrefix, Number(step.qrCode.split('-')[1] ?? '0')),
    })),
  }
}

export function createMockKitRepository(): KitRepository {
  return {
    async list(filter) {
      await mockGate('kits.list')
      requireStaff()
      const needle = filter.query.trim().toLocaleLowerCase('tr')
      // Prefixes are ASCII A–Z: Turkish casing would turn "BIO" into "bıo" and miss them.
      const prefix = filter.query.trim().toUpperCase()
      const rows = kitsTable
        .filter((kit) => filter.status === 'all' || kit.status === filter.status)
        .filter(
          (kit) =>
            !needle ||
            kit.draft.title.toLocaleLowerCase('tr').includes(needle) ||
            kit.slug.includes(needle) ||
            kit.qrPrefix === prefix,
        )
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const pageCount = Math.max(1, Math.ceil(rows.length / filter.pageSize))
      const page = Math.min(Math.max(1, filter.page), pageCount)
      return {
        items: rows.slice((page - 1) * filter.pageSize, page * filter.pageSize),
        total: rows.length,
        page,
        pageCount,
      }
    },

    async listAll() {
      await mockGate('kits.listAll')
      requireStaff()
      return kitsTable.all().toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async get(id) {
      await mockGate('kits.get')
      requireStaff()
      return getKit(id)
    },

    async create(input) {
      await mockGate('kits.create')
      const caller = requireStaff()
      validateIdentity(input.slug, input.qrPrefix)
      const id = crypto.randomUUID()
      const draft: KitDocument = input.document
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
      const parsed = kitDocumentSchema.safeParse(draft)
      if (!parsed.success) throw new AppError('validation', 'Kit taslağı geçersiz.')
      const timestamp = now()
      const kit: StudioKit = {
        id,
        slug: input.slug,
        qrPrefix: input.qrPrefix,
        status: 'draft',
        visibility: 'public',
        draft: parsed.data,
        publishedVersion: null,
        firstPublishedAt: null,
        lastPublishedAt: null,
        reviewNote: null,
        reviewedLockVersion: null,
        lockVersion: 0,
        publishedLockVersion: null,
        ownerId: caller.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: caller.userId,
      }
      kitsTable.insert(kit)
      reservePrefix(input.qrPrefix, id)
      appendAudit({
        actorId: caller.userId,
        action: 'kit.created',
        entity: 'kit',
        entityId: id,
        meta: { title: draft.title },
      })
      return kit
    },

    async update(id, draft, lockVersion) {
      await mockGate('kits.update')
      const caller = requireStaff()
      const kit = getKit(id)
      assertEditable(kit, caller.role)
      if (kit.lockVersion !== lockVersion) {
        throw new AppError('conflict', 'Bu kit başka bir yerde değiştirildi.', { latest: kit })
      }
      const parsed = kitDocumentSchema.safeParse(draft)
      if (!parsed.success) throw new AppError('validation', 'Taslak kaydedilemedi: yapı geçersiz.')
      const next = parsed.data
      if (next.id !== kit.id || next.slug !== kit.slug || next.qrPrefix !== kit.qrPrefix) {
        throw new AppError(
          'validation',
          'Adres ve QR öneki yalnızca “Yeniden adlandır” ile değişir.',
        )
      }
      if (next.qrSequence < kit.draft.qrSequence) {
        throw new AppError(
          'validation',
          'QR sayacı geri alınamaz (basılı kodlar yeniden kullanılmaz).',
        )
      }
      const saved = saveKit({
        ...kit,
        draft: { ...next, version: 0 },
        status: kit.status === 'published' ? 'draft' : kit.status,
        lockVersion: kit.lockVersion + 1,
        updatedAt: now(),
        updatedBy: caller.userId,
      })
      const auditKey = `${id}:${caller.userId}`
      if (Date.now() - (lastDraftAudit.get(auditKey) ?? 0) > DRAFT_AUDIT_INTERVAL_MS) {
        lastDraftAudit.set(auditKey, Date.now())
        appendAudit({
          actorId: caller.userId,
          action: 'kit.draft_saved',
          entity: 'kit',
          entityId: id,
        })
      }
      return saved
    },

    async rename(id, slug, qrPrefix, lockVersion) {
      await mockGate('kits.rename')
      const caller = requireStaff()
      const kit = getKit(id)
      if (!canRenameKit(kit)) {
        throw new AppError(
          'conflict',
          'Yayınlanmış kitin adresi ve QR öneki değişmez (basılı kodlar bozulur).',
        )
      }
      assertEditable(kit, caller.role)
      if (kit.lockVersion !== lockVersion)
        throw new AppError('conflict', 'Bu kit başka bir yerde değiştirildi.', { latest: kit })
      validateIdentity(slug, qrPrefix, id)
      const draft = withPrefix({ ...kit.draft, slug }, qrPrefix)
      const saved = saveKit({
        ...kit,
        slug,
        qrPrefix,
        draft,
        lockVersion: kit.lockVersion + 1,
        updatedAt: now(),
        updatedBy: caller.userId,
      })
      // Pending labels may already be printed with the old prefix: it stays with this kit.
      reservePrefix(kit.qrPrefix, id)
      reservePrefix(qrPrefix, id)
      appendAudit({
        actorId: caller.userId,
        action: 'kit.renamed',
        entity: 'kit',
        entityId: id,
        meta: { slug, qrPrefix },
      })
      return saved
    },

    async duplicate(id) {
      await mockGate('kits.duplicate')
      const caller = requireStaff()
      const source = getKit(id)
      // Room for "-kopya" and a "-N" counter within the 60-character limit, never a trailing dash.
      const slug = uniqueSlug(
        `${slugifyTr(source.slug, 44)}-kopya`,
        new Set(kitsTable.all().map((row) => row.slug)),
        'kopya',
      )
      const prefixes = prefixesHeldByOthers()
      let qrPrefix = source.qrPrefix
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (let i = 0; prefixes.has(qrPrefix) && i < letters.length * letters.length; i++) {
        const base = source.qrPrefix.slice(0, 2)
        qrPrefix = `${base}${letters[i % letters.length] ?? 'X'}${i >= letters.length ? (letters[Math.floor(i / letters.length)] ?? '') : ''}`
      }
      if (prefixes.has(qrPrefix)) {
        throw new AppError('conflict', 'Kopya için boş bir QR öneki bulunamadı.')
      }
      const kitId = crypto.randomUUID()
      const timestamp = now()
      const draft = withPrefix(
        {
          ...structuredClone(source.draft),
          id: kitId,
          slug,
          title: `${source.draft.title} (kopya)`.slice(0, 60),
          version: 0,
        },
        qrPrefix,
      )
      const parsed = studioKitSchema.safeParse({
        ...source,
        id: kitId,
        slug,
        qrPrefix,
        draft,
        status: 'draft',
        visibility: 'public',
        publishedVersion: null,
        firstPublishedAt: null,
        lastPublishedAt: null,
        reviewNote: null,
        reviewedLockVersion: null,
        lockVersion: 0,
        publishedLockVersion: null,
        ownerId: caller.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: caller.userId,
      } satisfies StudioKit)
      if (!parsed.success) throw new AppError('validation', 'Kit kopyalanamadı: yapı geçersiz.')
      const kit = parsed.data
      kitsTable.insert(kit)
      reservePrefix(qrPrefix, kitId)
      appendAudit({
        actorId: caller.userId,
        action: 'kit.duplicated',
        entity: 'kit',
        entityId: kitId,
        meta: { from: id },
      })
      return kit
    },

    async remove(id) {
      await mockGate('kits.remove')
      const caller = requireStaff({ role: 'admin' })
      const kit = getKit(id)
      if (!canDeleteKit(kit)) {
        throw new AppError('conflict', 'Yayınlanmış kit silinemez; bunun yerine arşivleyin.')
      }
      // Its pending labels may already be printed: the prefix is retired, never reused.
      reservePrefix(kit.qrPrefix, id)
      kitsTable.remove((row) => row.id === id)
      appendAudit({
        actorId: caller.userId,
        action: 'kit.deleted',
        entity: 'kit',
        entityId: id,
        meta: { title: kit.draft.title },
      })
    },

    async checkAvailability(slug, qrPrefix, exceptId) {
      await mockGate('kits.checkAvailability')
      requireStaff()
      return ensureUnique(slug, qrPrefix, exceptId)
    },

    async listTakenPrefixes() {
      await mockGate('kits.listTakenPrefixes')
      requireStaff()
      return [...prefixesHeldByOthers()].toSorted()
    },
  }
}

function resolveAsset(assetId: string) {
  const asset = mediaTable.find((row) => row.id === assetId)
  return asset ? { url: asset.url, alt: asset.alt } : undefined
}

export function createMockPublishingService(): PublishingService {
  return {
    async submitForReview(kitId, lockVersion) {
      await mockGate('publishing.submitForReview')
      const caller = requireStaff()
      const kit = getKit(kitId)
      if (kit.status === 'archived')
        throw new AppError('conflict', 'Arşivdeki kit incelemeye gönderilemez.')
      if (kit.status === 'in_review') throw new AppError('conflict', 'Kit zaten incelemede.')
      if (kit.lockVersion !== lockVersion)
        throw new AppError('conflict', 'Kaydedilmemiş değişiklikler var. Önce kaydedin.')
      const saved = saveKit({
        ...kit,
        status: 'in_review',
        reviewedLockVersion: kit.lockVersion,
        reviewNote: null,
        updatedAt: now(),
      })
      appendAudit({
        actorId: caller.userId,
        action: 'kit.submitted',
        entity: 'kit',
        entityId: kitId,
      })
      return saved
    },

    async withdrawReview(kitId) {
      await mockGate('publishing.withdrawReview')
      const caller = requireStaff()
      const kit = getKit(kitId)
      if (kit.status !== 'in_review') throw new AppError('conflict', 'Kit incelemede değil.')
      const saved = saveKit({
        ...kit,
        status: 'draft',
        reviewedLockVersion: null,
        updatedAt: now(),
      })
      appendAudit({
        actorId: caller.userId,
        action: 'kit.review_withdrawn',
        entity: 'kit',
        entityId: kitId,
      })
      return saved
    },

    async requestChanges(kitId, note) {
      await mockGate('publishing.requestChanges')
      const caller = requireStaff({ role: 'admin' })
      const kit = getKit(kitId)
      if (kit.status !== 'in_review') throw new AppError('conflict', 'Kit incelemede değil.')
      if (!note.trim())
        throw new AppError('validation', 'Editöre neyi değiştirmesi gerektiğini yazın.')
      const saved = saveKit({
        ...kit,
        status: 'draft',
        reviewNote: note.trim(),
        reviewedLockVersion: null,
        updatedAt: now(),
      })
      appendAudit({
        actorId: caller.userId,
        action: 'kit.changes_requested',
        entity: 'kit',
        entityId: kitId,
      })
      return saved
    },

    async publish(kitId, input) {
      await mockGate('publishing.publish')
      const caller = requireStaff({ role: 'admin' })
      const kit = getKit(kitId)
      if (kit.status === 'archived')
        throw new AppError('conflict', 'Arşivdeki kit yayınlanamaz. Önce arşivden çıkarın.')
      if (kit.lockVersion !== input.lockVersion) {
        throw new AppError(
          'conflict',
          'Kit bu arada değişti. Son hâlini gözden geçirip tekrar yayınlayın.',
          { latest: kit },
        )
      }
      const issues = validateKitForPublish(kit.draft)
      const { kit: resolved, missing } = resolveKitMedia(kit.draft, resolveAsset)
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

      // 1) Reserve the version (a retry after an interrupted publish reuses it — idempotent).
      const pending = versionsTable.find(
        (row) =>
          row.kitId === kitId &&
          row.finalizedAt === null &&
          row.sourceLockVersion === kit.lockVersion,
      )
      const versionNumber =
        pending?.version ??
        Math.max(
          kit.publishedVersion ?? 0,
          ...versionsTable.filter((row) => row.kitId === kitId).map((row) => row.version),
        ) + 1
      const timestamp = now()
      const document: KitDocument = { ...resolved, version: versionNumber }
      const version: KitVersion = pending ?? {
        kitId,
        version: versionNumber,
        document,
        notes: input.notes.trim().slice(0, 500),
        publishedBy: caller.userId,
        publishedAt: timestamp,
        aiReviewConfirmed: input.aiReviewConfirmed,
        finalizedAt: null,
        sourceLockVersion: kit.lockVersion,
      }
      if (!pending) versionsTable.insert(version)

      // 2) Write the immutable snapshot (same content again = success).
      await mockGate('publishing.writeSnapshot')
      mockDoc(MOCK_DOCS.version(kit.slug, versionNumber), kitDocumentSchema).set(version.document)

      // 3) Finalize: registry, kit row, regenerated indexes.
      await mockGate('publishing.finalize')
      const { insert, activeCodes } = syncQrRows(
        version.document,
        qrTable.filter((row) => row.kitId === kitId),
        timestamp,
      )
      qrTable.insertMany(insert)
      qrTable.update(
        (row) => row.kitId === kitId,
        (row) => ({ ...row, active: activeCodes.has(row.code) }),
      )
      const finalized: KitVersion = { ...version, finalizedAt: timestamp }
      versionsTable.update(
        (row) => row.kitId === kitId && row.version === versionNumber,
        () => finalized,
      )
      const saved = saveKit({
        ...kit,
        status: 'published',
        visibility: input.visibility,
        publishedVersion: versionNumber,
        publishedLockVersion: kit.lockVersion,
        firstPublishedAt: kit.firstPublishedAt ?? timestamp,
        lastPublishedAt: timestamp,
        reviewNote: null,
        reviewedLockVersion: null,
        updatedAt: timestamp,
      })
      regenerate()
      appendAudit({
        actorId: caller.userId,
        action: 'kit.published',
        entity: 'kit',
        entityId: kitId,
        meta: { version: versionNumber, visibility: input.visibility, ai: input.aiReviewConfirmed },
      })
      return { kit: saved, version: finalized }
    },

    async setVisibility(kitId, visibility) {
      await mockGate('publishing.setVisibility')
      const caller = requireStaff({ role: 'admin' })
      const saved = saveKit({ ...getKit(kitId), visibility, updatedAt: now() })
      regenerate()
      appendAudit({
        actorId: caller.userId,
        action: 'kit.visibility',
        entity: 'kit',
        entityId: kitId,
        meta: { visibility },
      })
      return saved
    },

    async archive(kitId) {
      await mockGate('publishing.archive')
      const caller = requireStaff({ role: 'admin' })
      const kit = getKit(kitId)
      if (kit.status === 'archived') return kit
      const saved = saveKit({ ...kit, status: 'archived', updatedAt: now() })
      regenerate()
      appendAudit({
        actorId: caller.userId,
        action: 'kit.archived',
        entity: 'kit',
        entityId: kitId,
      })
      return saved
    },

    async unarchive(kitId) {
      await mockGate('publishing.unarchive')
      const caller = requireStaff({ role: 'admin' })
      const kit = getKit(kitId)
      if (kit.status !== 'archived') return kit
      const inSync = kit.publishedVersion !== null && kit.publishedLockVersion === kit.lockVersion
      const saved = saveKit({ ...kit, status: inSync ? 'published' : 'draft', updatedAt: now() })
      regenerate()
      appendAudit({
        actorId: caller.userId,
        action: 'kit.unarchived',
        entity: 'kit',
        entityId: kitId,
      })
      return saved
    },

    async listVersions(kitId) {
      await mockGate('publishing.listVersions')
      requireStaff()
      return versionsTable
        .filter((row) => row.kitId === kitId && row.finalizedAt !== null)
        .toSorted((a, b) => b.version - a.version)
    },

    async restoreToDraft(kitId, versionNumber, lockVersion) {
      await mockGate('publishing.restoreToDraft')
      const caller = requireStaff()
      const kit = getKit(kitId)
      assertEditable(kit, caller.role)
      if (kit.lockVersion !== lockVersion)
        throw new AppError('conflict', 'Bu kit başka bir yerde değiştirildi.', { latest: kit })
      const version = versionsTable.find(
        (row) => row.kitId === kitId && row.version === versionNumber,
      )
      if (!version) throw new AppError('not_found', 'Sürüm bulunamadı.')
      // Keep identity and the QR counter; media refs go back to ids only (drafts store no URLs).
      const draft: KitDocument = {
        ...structuredClone(version.document),
        version: 0,
        slug: kit.slug,
        qrPrefix: kit.qrPrefix,
        qrSequence: Math.max(kit.draft.qrSequence, version.document.qrSequence),
      }
      const saved = saveKit({
        ...kit,
        draft,
        status: 'draft',
        lockVersion: kit.lockVersion + 1,
        updatedAt: now(),
        updatedBy: caller.userId,
      })
      appendAudit({
        actorId: caller.userId,
        action: 'kit.version_restored',
        entity: 'kit',
        entityId: kitId,
        meta: { version: versionNumber },
      })
      return saved
    },

    async regenerateSnapshots() {
      await mockGate('publishing.regenerate')
      const caller = requireStaff({ role: 'admin' })
      for (const version of versionsTable.filter((row) => row.finalizedAt !== null)) {
        mockDoc(MOCK_DOCS.version(version.document.slug, version.version), kitDocumentSchema).set(
          version.document,
        )
      }
      regenerate()
      appendAudit({
        actorId: caller.userId,
        action: 'published.regenerated',
        entity: 'published',
        entityId: null,
      })
    },
  }
}

export function createMockQrRegistry(): QrRegistry {
  return {
    async listForKit(kitId) {
      await mockGate('qr.listForKit')
      requireStaff()
      const kit = getKit(kitId)
      const latest = latestVersionOf(kitId, versionsTable.all())
      const liveCodes = new Set<string>(
        latest
          ? [latest.document.qrPrefix, ...latest.document.steps.map((step) => step.qrCode)]
          : [],
      )
      const live = kit.status !== 'archived'
      const draftCodes = new Set(kit.draft.steps.map((step) => step.qrCode))
      const codes: KitQrCode[] = [
        {
          code: kit.qrPrefix,
          stepId: null,
          title: kit.draft.title,
          icon: kit.draft.icon,
          cardNumber: null,
          state: live && liveCodes.has(kit.qrPrefix) ? 'live' : 'pending',
        },
        ...kit.draft.steps.map((step, index) => ({
          code: step.qrCode,
          stepId: step.id,
          title: step.title,
          icon: step.icon,
          cardNumber: index + 1,
          state: (live && liveCodes.has(step.qrCode) ? 'live' : 'pending') as KitQrCode['state'],
        })),
      ]
      for (const row of qrTable.filter(
        (candidate) => candidate.kitId === kitId && candidate.stepId !== null,
      )) {
        if (draftCodes.has(row.code)) continue
        // A card deleted only in the draft stays in the published qr-index until the next
        // publish; its code is retired only once it is in neither the published version nor
        // the draft.
        const published = liveCodes.has(row.code)
        codes.push({
          code: row.code,
          stepId: row.stepId,
          title: 'Silinmiş kart',
          icon: { kind: 'emoji', value: '🗑️' },
          cardNumber: null,
          state: published ? (live ? 'live' : 'pending') : 'retired',
        })
      }
      return codes
    },
  }
}

/** Seeding helper: stores a kit row as-is (system context, no validation shortcuts). */
export function insertKitRow(kit: StudioKit) {
  kitsTable.upsert(kit, (row) => row.id)
}
