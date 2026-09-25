import type { Catalog, CatalogEntry, QrIndex } from '../model/catalog.ts'
import type { KitDocument } from '../model/kit.ts'
import type { KitVersion, QrCodeRow, StudioKit } from '../model/studio.ts'

/** Bumped when a new snapshot format needs a newer app (ADR 0019). */
export const MIN_APP_VERSION = 1

export function latestVersionOf(kitId: string, versions: readonly KitVersion[]) {
  let latest: KitVersion | undefined
  for (const version of versions) {
    if (version.kitId !== kitId || version.finalizedAt === null) continue
    if (!latest || version.version > latest.version) latest = version
  }
  return latest
}

export function toCatalogEntry(document: KitDocument, publishedAt: string): CatalogEntry {
  return {
    id: document.id,
    slug: document.slug,
    version: document.version,
    title: document.title,
    tagline: document.tagline,
    icon: document.icon,
    ...(document.cover ? { cover: document.cover } : {}),
    category: document.category,
    ageRange: document.ageRange,
    durationMinutes: document.durationMinutes,
    theme: document.theme,
    stepCount: document.steps.length,
    badge: document.badge,
    qrPrefix: document.qrPrefix,
    publishedAt,
  }
}

/**
 * `catalog.json` is regenerated from the database on every publish/visibility/archive change
 * (never patched), so concurrent publishes cannot lose each other's kits.
 */
export function buildCatalog(
  kits: readonly StudioKit[],
  versions: readonly KitVersion[],
  generation: number,
  now: string,
): Catalog {
  const entries: CatalogEntry[] = []
  for (const kit of kits) {
    if (kit.status === 'archived' || kit.publishedVersion === null || kit.visibility !== 'public')
      continue
    const latest = latestVersionOf(kit.id, versions)
    if (latest) entries.push(toCatalogEntry(latest.document, latest.publishedAt))
  }
  entries.sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  return { generatedAt: now, generation, minAppVersion: MIN_APP_VERSION, kits: entries }
}

/**
 * `qr-index.json` maps every code ever issued to its current card. Codes survive reorders and
 * renames (they point at step ids); removed cards and archived kits resolve to "inactive".
 * Unlisted kits are included — a printed QR must keep working even when not in the catalog.
 */
export function buildQrIndex(
  kits: readonly StudioKit[],
  versions: readonly KitVersion[],
  qrRows: readonly QrCodeRow[],
  now: string,
): QrIndex {
  const codes: QrIndex['codes'] = {}
  const kitsById = new Map(kits.map((kit) => [kit.id, kit]))
  for (const row of qrRows) {
    const kit = kitsById.get(row.kitId)
    if (!kit || kit.publishedVersion === null) continue
    const latest = latestVersionOf(kit.id, versions)
    if (!latest) continue
    const kitState = kit.status === 'archived' ? 'archived' : 'published'
    if (row.stepId === null) {
      codes[row.code] = {
        kitId: kit.id,
        kitSlug: latest.document.slug,
        stepId: null,
        stepSlug: null,
        active: true,
        kitState,
      }
      continue
    }
    const step = latest.document.steps.find((candidate) => candidate.id === row.stepId)
    codes[row.code] = {
      kitId: kit.id,
      kitSlug: latest.document.slug,
      stepId: row.stepId,
      stepSlug: step?.slug ?? null,
      active: Boolean(step),
      kitState,
    }
  }
  return { generatedAt: now, codes }
}

/** Registry rows to insert or deactivate after publishing `document`. */
export function syncQrRows(
  document: KitDocument,
  existing: readonly QrCodeRow[],
  now: string,
): { insert: QrCodeRow[]; activeCodes: Set<string> } {
  const known = new Set(existing.map((row) => row.code))
  const insert: QrCodeRow[] = []
  const activeCodes = new Set<string>([document.qrPrefix])
  if (!known.has(document.qrPrefix)) {
    insert.push({
      code: document.qrPrefix,
      kitId: document.id,
      stepId: null,
      active: true,
      createdAt: now,
    })
  }
  for (const step of document.steps) {
    activeCodes.add(step.qrCode)
    if (!known.has(step.qrCode)) {
      insert.push({
        code: step.qrCode,
        kitId: document.id,
        stepId: step.id,
        active: true,
        createdAt: now,
      })
    }
  }
  return { insert, activeCodes }
}
