import { queryOptions } from '@tanstack/react-query'

import {
  catalogSchema,
  kitDocumentSchema,
  latestPointerSchema,
  migrateKit,
  MIN_APP_VERSION,
  qrIndexSchema,
  type Catalog,
  type KitDocument,
  type QrIndex,
} from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import { mockDoc, mockGate } from '@/shared/api/mock-db'
import { MOCK_DOCS } from '@/shared/api/mock-tables'
import { KIDS_QUERY_ROOT } from '@/shared/api/query-keys'
import { isSupabaseBackend } from '@/shared/config/backend'

import { createSupabaseContentSource } from './content.supabase'

/**
 * Reads the published snapshot files (catalog.json, qr-index.json, kits/{slug}/latest.json,
 * v{n}.json). Public content — no session, never the database (ADR 0007).
 */
export type ContentSource = {
  catalog(): Promise<Catalog>
  qrIndex(): Promise<QrIndex>
  kit(slug: string): Promise<KitDocument>
  kitVersion(slug: string, version: number): Promise<KitDocument>
}

const EMPTY_CATALOG: Catalog = {
  generatedAt: new Date(0).toISOString(),
  generation: 0,
  minAppVersion: MIN_APP_VERSION,
  kits: [],
}

function readVersion(slug: string, version: number) {
  // Stored documents are validated with the kit schema; migrateKit handles older snapshots.
  const raw = mockDoc(MOCK_DOCS.version(slug, version), kitDocumentSchema).get()
  if (!raw) throw new AppError('not_found', 'Bu kit bulunamadı.')
  return migrateKit(raw)
}

function createMockContentSource(): ContentSource {
  return {
    async catalog() {
      await mockGate('content.catalog')
      return mockDoc(MOCK_DOCS.catalog, catalogSchema).get() ?? EMPTY_CATALOG
    },
    async qrIndex() {
      await mockGate('content.qrIndex')
      return (
        mockDoc(MOCK_DOCS.qrIndex, qrIndexSchema).get() ?? {
          generatedAt: EMPTY_CATALOG.generatedAt,
          codes: {},
        }
      )
    },
    async kit(slug) {
      await mockGate('content.kit')
      const latest = mockDoc(MOCK_DOCS.latest(slug), latestPointerSchema).get()
      if (!latest) throw new AppError('not_found', 'Bu kit bulunamadı.')
      return readVersion(slug, latest.version)
    },
    async kitVersion(slug, version) {
      await mockGate('content.kitVersion')
      return readVersion(slug, version)
    },
  }
}

export const contentSource: ContentSource = isSupabaseBackend
  ? createSupabaseContentSource()
  : createMockContentSource()

export const contentKeys = {
  all: [KIDS_QUERY_ROOT, 'content'] as const,
  catalog: () => [...contentKeys.all, 'catalog'] as const,
  qrIndex: () => [...contentKeys.all, 'qr-index'] as const,
  kit: (slug: string) => [...contentKeys.all, 'kit', slug] as const,
}

/** Catalog and QR index are small and change on publish: short stale time, offline-first. */
export function catalogQueryOptions() {
  return queryOptions({
    queryKey: contentKeys.catalog(),
    queryFn: () => contentSource.catalog(),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  })
}

export function qrIndexQueryOptions() {
  return queryOptions({
    queryKey: contentKeys.qrIndex(),
    queryFn: () => contentSource.qrIndex(),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  })
}

export function publishedKitQueryOptions(slug: string) {
  return queryOptions({
    queryKey: contentKeys.kit(slug),
    queryFn: () => contentSource.kit(slug),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  })
}

/** Is this installed app too old for the published content? (ADR 0019) */
export function needsAppUpdate(catalog: Catalog) {
  return catalog.minAppVersion > MIN_APP_VERSION
}
