import {
  AI_ICON_MAX_BYTES,
  checkAiSvg,
  collectMediaAssetIds,
  kitVersionSchema,
  studioKitSchema,
} from '@/entities/kit'
import { explorerSchema } from '@/entities/explorer'
import { mediaAssetSchema, type MediaAsset } from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockDbSize, mockGate, mockTable } from '@/shared/api/mock-db'
import { deleteMockMedia, mockMediaUrl, putMockMedia } from '@/shared/api/mock-media'
import { MOCK_TABLES } from '@/shared/api/mock-tables'
import { AUDIO_MAX_BYTES, CAPTIONS_MAX_BYTES, ICON_MAX_BYTES } from '@/shared/lib/media-files'

import type { MediaRepository, MediaUsage } from './port'

export const mediaTable = mockTable(MOCK_TABLES.mediaAssets, mediaAssetSchema)
const kitsTable = mockTable(MOCK_TABLES.kits, studioKitSchema)
const versionsTable = mockTable(MOCK_TABLES.kitVersions, kitVersionSchema)
const explorersTable = mockTable(MOCK_TABLES.explorers, explorerSchema)

const GB = 1000 ** 3
const MB = 1000 ** 2
/** Supabase Free plan limits (verified 2026-09, ADR 0020). */
const STORAGE_LIMIT = 1 * GB
const DATABASE_LIMIT = 500 * MB
const EGRESS_LIMIT = 10 * GB
/** Server-side bucket limits (defence in depth; the client already resizes). */
const IMAGE_LIMIT = 300 * 1000
const SVG_LIMIT = 12 * 1000

const ALLOWED_MIME: Record<MediaAsset['kind'], RegExp> = {
  image: /^image\/(webp|png|jpeg)$/,
  icon: /^image\/(webp|png|jpeg)$/,
  audio: /^audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|webm|wav)$/,
  captions: /^text\/vtt$/,
  'ai-scene': /^image\/svg\+xml$/,
  'ai-icon': /^image\/svg\+xml$/,
}

/** AI drawings are served as SVG: the same safety check as when they were generated. */
async function unsafeSvg(kind: MediaAsset['kind'], blob: Blob) {
  if (kind === 'ai-scene') return checkAiSvg(await blob.text()).length > 0
  if (kind === 'ai-icon') {
    const problems = checkAiSvg(await blob.text(), {
      maxBytes: AI_ICON_MAX_BYTES,
      requireViewBox: false,
    })
    return problems.length > 0
  }
  return false
}

function sizeLimit(kind: MediaAsset['kind']) {
  switch (kind) {
    case 'image':
      return IMAGE_LIMIT
    case 'icon':
      return ICON_MAX_BYTES
    case 'audio':
      return AUDIO_MAX_BYTES
    case 'captions':
      return CAPTIONS_MAX_BYTES
    case 'ai-scene':
    case 'ai-icon':
      return SVG_LIMIT
  }
}

export function computeUsage(assetId: string): MediaUsage {
  const kits = new Map<string, MediaUsage['kits'][number]>()
  for (const kit of kitsTable.all()) {
    if (collectMediaAssetIds(kit.draft).has(assetId)) {
      kits.set(kit.id, { id: kit.id, title: kit.draft.title, inDraft: true, versions: [] })
    }
  }
  for (const version of versionsTable.all()) {
    if (!collectMediaAssetIds(version.document).has(assetId)) continue
    const entry = kits.get(version.kitId) ?? {
      id: version.kitId,
      title: version.document.title,
      inDraft: false,
      versions: [],
    }
    entry.versions.push(version.version)
    kits.set(version.kitId, entry)
  }
  return { kits: [...kits.values()] }
}

export function createMockMediaRepository(): MediaRepository {
  return {
    async list(filter) {
      await mockGate('media.list')
      requireStaff()
      const needle = filter.query.trim().toLocaleLowerCase('tr')
      return mediaTable
        .filter((asset) => filter.kind === 'all' || asset.kind === filter.kind)
        .filter(
          (asset) =>
            !needle ||
            asset.name.toLocaleLowerCase('tr').includes(needle) ||
            asset.alt.toLocaleLowerCase('tr').includes(needle),
        )
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async getMany(ids) {
      await mockGate('media.getMany')
      requireStaff()
      const wanted = new Set(ids)
      return mediaTable.filter((asset) => wanted.has(asset.id))
    },

    async upload(input) {
      await mockGate('media.upload')
      const caller = requireStaff()
      if (input.blob.type.startsWith('video/')) {
        throw new AppError(
          'validation',
          'Video yüklenmez. Videoları YouTube ya da https MP4 bağlantısı olarak ekleyin.',
        )
      }
      // The declared type must be the file's own type: no PNG label on an SVG body.
      if (!ALLOWED_MIME[input.kind].test(input.mime) || input.blob.type !== input.mime) {
        throw new AppError('validation', 'Bu dosya türü kabul edilmiyor.')
      }
      if (input.blob.size > sizeLimit(input.kind)) {
        throw new AppError('validation', 'Dosya boyut sınırını aşıyor.')
      }
      if ((input.kind === 'image' || input.kind === 'icon') && !input.alt.trim()) {
        throw new AppError('validation', 'Görseller için alternatif metin zorunlu.')
      }
      if (await unsafeSvg(input.kind, input.blob)) {
        throw new AppError('validation', 'Çizim güvenlik kontrolünden geçemedi.')
      }
      const id = crypto.randomUUID()
      await putMockMedia(id, input.blob)
      const asset: MediaAsset = {
        id,
        kind: input.kind,
        name: input.name.slice(0, 120),
        mime: input.mime,
        bytes: input.blob.size,
        width: input.width,
        height: input.height,
        durationSec: input.durationSec,
        alt: input.alt.trim().slice(0, 240),
        url: mockMediaUrl(id),
        source: input.source ?? 'upload',
        sceneGroup: input.sceneGroup ?? null,
        sceneState: input.sceneState ?? null,
        createdBy: caller.userId,
        createdAt: new Date().toISOString(),
      }
      mediaTable.insert(asset)
      return asset
    },

    async updateAlt(id, alt) {
      await mockGate('media.updateAlt')
      requireStaff()
      const updated = mediaTable.update(
        (asset) => asset.id === id,
        (asset) => ({ ...asset, alt: alt.trim().slice(0, 240) }),
      )[0]
      if (!updated) throw new AppError('not_found')
      return updated
    },

    async usage(id) {
      await mockGate('media.usage')
      requireStaff()
      return computeUsage(id)
    },

    async remove(id) {
      await mockGate('media.remove')
      const caller = requireStaff({ role: 'admin' })
      const asset = mediaTable.find((row) => row.id === id)
      if (!asset) throw new AppError('not_found')
      const usage = computeUsage(id)
      if (usage.kits.length > 0) {
        throw new AppError('conflict', 'Bu dosya kullanımda. Önce kitlerden kaldırın.', { usage })
      }
      mediaTable.remove((row) => row.id === id)
      await deleteMockMedia(id)
      appendAudit({
        actorId: caller.userId,
        action: 'media.deleted',
        entity: 'media',
        entityId: id,
        meta: { name: asset.name },
      })
    },

    async quota() {
      await mockGate('media.quota')
      requireStaff()
      const assets = mediaTable.all()
      const storageBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0)
      // Egress ≈ new devices per month × one download of every published kit's media + JSON.
      const monthAgo = Date.now() - 30 * 86_400_000
      const newDevices = explorersTable.count(
        (explorer) => Date.parse(explorer.createdAt) > monthAgo,
      )
      const publishedAssetIds = new Set<string>()
      let jsonBytes = 0
      for (const kit of kitsTable.all()) {
        if (kit.publishedVersion === null || kit.status === 'archived') continue
        const latest = versionsTable.find(
          (row) => row.kitId === kit.id && row.version === kit.publishedVersion,
        )
        if (!latest) continue
        jsonBytes += JSON.stringify(latest.document).length
        for (const assetId of collectMediaAssetIds(latest.document)) publishedAssetIds.add(assetId)
      }
      const publishedMediaBytes = assets
        .filter((asset) => publishedAssetIds.has(asset.id))
        .reduce((sum, asset) => sum + asset.bytes, 0)
      return {
        storageBytes,
        storageLimitBytes: STORAGE_LIMIT,
        databaseBytes: mockDbSize(),
        databaseLimitBytes: DATABASE_LIMIT,
        estimatedMonthlyEgressBytes: Math.max(1, newDevices) * (publishedMediaBytes + jsonBytes),
        egressLimitBytes: EGRESS_LIMIT,
      }
    },
  }
}
