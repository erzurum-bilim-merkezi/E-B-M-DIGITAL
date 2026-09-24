import type { MediaAsset, MediaKind } from '@/entities/studio'

export type MediaFilter = { kind: MediaKind | 'all'; query: string }

export type NewMedia = {
  blob: Blob
  kind: MediaKind
  name: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  durationSec: number | null
  source?: 'upload' | 'ai'
  sceneGroup?: string | null
  sceneState?: string | null
}

export type MediaUsage = {
  kits: { id: string; title: string; inDraft: boolean; versions: number[] }[]
}

export type StorageQuota = {
  storageBytes: number
  storageLimitBytes: number
  databaseBytes: number
  databaseLimitBytes: number
  /** Formula from ADR 0020: new devices × first download of published kits. */
  estimatedMonthlyEgressBytes: number
  egressLimitBytes: number
}

export type MediaRepository = {
  list(filter: MediaFilter): Promise<MediaAsset[]>
  /** Assets by id (resolving references in drafts and previews). */
  getMany(ids: readonly string[]): Promise<MediaAsset[]>
  upload(input: NewMedia): Promise<MediaAsset>
  updateAlt(id: string, alt: string): Promise<MediaAsset>
  usage(id: string): Promise<MediaUsage>
  /** Refused while any draft or published version uses the asset. */
  remove(id: string): Promise<void>
  quota(): Promise<StorageQuota>
}
