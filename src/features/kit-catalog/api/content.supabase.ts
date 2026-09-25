import { z } from 'zod'

import {
  catalogSchema,
  KitMigrationError,
  latestPointerSchema,
  migrateKit,
  MIN_APP_VERSION,
  qrIndexSchema,
} from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import { apiClient, HttpError } from '@/shared/api/http-client'
import { publicObjectUrl } from '@/shared/api/supabase'

import type { ContentSource } from './content'

/*
 * Published snapshots on Supabase Storage (bucket `published`, public, ADR 0007/0020). No session:
 * kids read plain files through the CDN. catalog.json, qr-index.json and latest.json change on
 * every publish (revalidated on each request); v<n>.json never changes (cacheable forever).
 */

const EMPTY_TIME = new Date(0).toISOString()

/** Storage answers a missing object with 400 or 404: before the first publish that is normal. */
function isMissing(error: unknown) {
  return error instanceof HttpError && (error.status === 400 || error.status === 404)
}

async function read<T>(path: string, schema: z.ZodType<T>, fresh: boolean): Promise<T | null> {
  try {
    return await apiClient.get(publicObjectUrl('published', path), schema, {
      cache: fresh ? 'no-cache' : 'default',
    })
  } catch (error) {
    if (isMissing(error)) return null
    if (error instanceof HttpError) throw new AppError('unavailable')
    if (error instanceof z.ZodError) {
      throw new AppError('unavailable', 'Yayınlanmış içerik okunamadı. Biraz sonra tekrar dene.')
    }
    throw new AppError('network')
  }
}

async function readVersion(slug: string, version: number) {
  const raw = await read(`kits/${slug}/v${version}.json`, z.unknown(), false)
  if (raw === null) throw new AppError('not_found', 'Bu kit bulunamadı.')
  try {
    return migrateKit(raw)
  } catch (error) {
    if (error instanceof KitMigrationError) throw new AppError('unavailable', error.message)
    throw error
  }
}

export function createSupabaseContentSource(): ContentSource {
  return {
    async catalog() {
      return (
        (await read('catalog.json', catalogSchema, true)) ?? {
          generatedAt: EMPTY_TIME,
          generation: 0,
          minAppVersion: MIN_APP_VERSION,
          kits: [],
        }
      )
    },
    async qrIndex() {
      return (
        (await read('qr-index.json', qrIndexSchema, true)) ?? { generatedAt: EMPTY_TIME, codes: {} }
      )
    },
    async kit(slug) {
      const latest = await read(`kits/${slug}/latest.json`, latestPointerSchema, true)
      if (!latest) throw new AppError('not_found', 'Bu kit bulunamadı.')
      return readVersion(slug, latest.version)
    },
    kitVersion: readVersion,
  }
}
