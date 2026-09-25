import { z } from 'zod'

import { mediaAssetSchema, type MediaAsset } from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { publicObjectUrl, staffClient, toAppError, unwrap } from '@/shared/api/supabase'
import { AUDIO_MAX_BYTES, CAPTIONS_MAX_BYTES, ICON_MAX_BYTES } from '@/shared/lib/media-files'

import type { MediaRepository, MediaUsage, StorageQuota } from './port'

/*
 * Media library on Supabase (ADR 0020): files in the public `media` bucket under uploads/<id>,
 * one media_assets row each. The browser checks type, size and alt text first (same rules as
 * the mock); media_register checks them again against the stored object. AI drawings are stored
 * by the ai-generate function, never uploaded from here.
 */

const IMAGE_LIMIT = 300 * 1000

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'text/vtt': 'vtt',
}

const ALLOWED_MIME: Partial<Record<MediaAsset['kind'], RegExp>> = {
  image: /^image\/(webp|png|jpeg)$/,
  icon: /^image\/(webp|png)$/,
  audio: /^audio\/(mpeg|mp4)$/,
  captions: /^text\/vtt$/,
}

const SIZE_LIMIT: Partial<Record<MediaAsset['kind'], number>> = {
  image: IMAGE_LIMIT,
  icon: ICON_MAX_BYTES,
  audio: AUDIO_MAX_BYTES,
  captions: CAPTIONS_MAX_BYTES,
}

const COLUMNS =
  'id, kind, name, mime, bytes, width, height, durationSec:duration_sec, alt, path, source, sceneGroup:scene_group, sceneState:scene_state, createdBy:created_by, createdAt:created_at'

const rowSchema = mediaAssetSchema.omit({ url: true }).extend({ path: z.string() })

/** A stored row → the asset the app uses (the URL is derived from the object path). */
function toAsset(row: unknown): MediaAsset {
  const { path, ...asset } = rowSchema.parse(row)
  return { ...asset, url: publicObjectUrl('media', path) }
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return unwrap(await staffClient().rpc(name, args))
}

export function createSupabaseMediaRepository(): MediaRepository {
  return {
    async list(filter) {
      let query = staffClient().from('media_assets').select(COLUMNS).order('created_at', {
        ascending: false,
      })
      if (filter.kind !== 'all') query = query.eq('kind', filter.kind)
      const needle = filter.query
        .trim()
        .replace(/[%,()*]/g, ' ')
        .trim()
      if (needle) query = query.or(`name.ilike.*${needle}*,alt.ilike.*${needle}*`)
      const rows = unwrap(await query)
      return z.array(z.unknown()).parse(rows).map(toAsset)
    },

    async getMany(ids) {
      if (ids.length === 0) return []
      const rows = unwrap(
        await staffClient()
          .from('media_assets')
          .select(COLUMNS)
          .in('id', [...ids]),
      )
      return z.array(z.unknown()).parse(rows).map(toAsset)
    },

    async upload(input) {
      if (input.blob.type.startsWith('video/')) {
        throw new AppError(
          'validation',
          'Video yüklenmez. Videoları YouTube ya da https MP4 bağlantısı olarak ekleyin.',
        )
      }
      const allowed = ALLOWED_MIME[input.kind]
      const extension = EXTENSIONS[input.mime]
      // The declared type must be the file's own type: no PNG label on an SVG body.
      if (!allowed || !extension || !allowed.test(input.mime) || input.blob.type !== input.mime) {
        throw new AppError('validation', 'Bu dosya türü kabul edilmiyor.')
      }
      if (input.blob.size > (SIZE_LIMIT[input.kind] ?? 0)) {
        throw new AppError('validation', 'Dosya boyut sınırını aşıyor.')
      }
      if ((input.kind === 'image' || input.kind === 'icon') && !input.alt.trim()) {
        throw new AppError('validation', 'Görseller için alternatif metin zorunlu.')
      }

      const id = crypto.randomUUID()
      const path = `uploads/${id}.${extension}`
      const bucket = staffClient().storage.from('media')
      const uploaded = await bucket.upload(path, await input.blob.arrayBuffer(), {
        contentType: input.mime,
        // Every upload has its own id: the file never changes.
        cacheControl: '31536000',
        upsert: false,
      })
      if (uploaded.error) throw toAppError(uploaded.error)
      try {
        return toAsset(
          await rpc('media_register', {
            p_id: id,
            p_kind: input.kind,
            p_name: input.name,
            p_mime: input.mime,
            p_alt: input.alt,
            p_width: input.width,
            p_height: input.height,
            p_duration_sec: input.durationSec,
          }),
        )
      } catch (error) {
        // Not registered: nothing can use the file, so it goes again.
        await bucket.remove([path]).catch(() => undefined)
        throw error
      }
    },

    async updateAlt(id, alt) {
      return toAsset(await rpc('media_update_alt', { p_id: id, p_alt: alt }))
    },

    async usage(id): Promise<MediaUsage> {
      return z
        .object({
          kits: z.array(
            z.object({
              id: z.uuid(),
              title: z.string(),
              inDraft: z.boolean(),
              versions: z.array(z.int()),
            }),
          ),
        })
        .parse(await rpc('media_usage', { p_id: id }))
    },

    async remove(id) {
      const path = z.string().parse(await rpc('media_delete', { p_id: id }))
      // The record is gone; a leftover file is harmless and never referenced again.
      await staffClient()
        .storage.from('media')
        .remove([path])
        .catch(() => undefined)
    },

    async quota(): Promise<StorageQuota> {
      return z
        .object({
          storageBytes: z.number(),
          storageLimitBytes: z.number(),
          databaseBytes: z.number(),
          databaseLimitBytes: z.number(),
          estimatedMonthlyEgressBytes: z.number(),
          egressLimitBytes: z.number(),
        })
        .parse(await rpc('storage_quota'))
    },
  }
}
