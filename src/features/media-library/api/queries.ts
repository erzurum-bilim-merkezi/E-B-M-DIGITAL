import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import type { MediaKind } from '@/entities/studio'
import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'
import {
  checkAudioFile,
  checkCaptionsFile,
  ICON_MAX_BYTES,
  isVideoFile,
  MediaFileError,
  probeAudioDuration,
  processImage,
} from '@/shared/lib/media-files'

import { mediaRepository } from './index'
import type { MediaFilter } from './port'

export const mediaKeys = {
  all: [STUDIO_QUERY_ROOT, 'media'] as const,
  list: (filter: MediaFilter) => [...mediaKeys.all, 'list', filter] as const,
  many: (ids: readonly string[]) => [...mediaKeys.all, 'many', ids.toSorted()] as const,
  usage: (id: string) => [...mediaKeys.all, 'usage', id] as const,
  quota: () => [...mediaKeys.all, 'quota'] as const,
}

export function mediaListQueryOptions(filter: MediaFilter) {
  return queryOptions({
    queryKey: mediaKeys.list(filter),
    queryFn: () => mediaRepository.list(filter),
  })
}

export function mediaManyQueryOptions(ids: readonly string[]) {
  return queryOptions({
    queryKey: mediaKeys.many(ids),
    queryFn: () => mediaRepository.getMany(ids),
    enabled: ids.length > 0,
  })
}

export function mediaUsageQueryOptions(id: string) {
  return queryOptions({ queryKey: mediaKeys.usage(id), queryFn: () => mediaRepository.usage(id) })
}

export function storageQuotaQueryOptions() {
  return queryOptions({ queryKey: mediaKeys.quota(), queryFn: () => mediaRepository.quota() })
}

export type UploadRequest = {
  file: File
  kind: Extract<MediaKind, 'image' | 'icon' | 'audio' | 'captions'>
  alt: string
}

/**
 * Validates and prepares a file in the browser (resize/re-encode images, probe audio, check
 * VTT), then stores it. Videos are refused with the "link it instead" message.
 */
export async function prepareAndUpload({ file, kind, alt }: UploadRequest) {
  if (isVideoFile(file)) {
    throw new MediaFileError(
      'Videolar yüklenmez; YouTube ya da https MP4 bağlantısı olarak ekleyin.',
    )
  }
  const name = file.name.replace(/\.[^.]+$/, '')
  if (kind === 'image' || kind === 'icon') {
    const image = await processImage(
      file,
      kind === 'icon' ? { maxEdge: 512, targetBytes: ICON_MAX_BYTES, square: true } : {},
    )
    return mediaRepository.upload({
      blob: image.blob,
      kind,
      name,
      alt,
      mime: image.mime,
      width: image.width,
      height: image.height,
      durationSec: null,
    })
  }
  if (kind === 'audio') {
    checkAudioFile(file)
    const durationSec = await probeAudioDuration(file).catch(() => null)
    return mediaRepository.upload({
      blob: file,
      kind,
      name,
      alt,
      mime: file.type,
      width: null,
      height: null,
      durationSec,
    })
  }
  await checkCaptionsFile(file)
  return mediaRepository.upload({
    blob: new Blob([await file.arrayBuffer()], { type: 'text/vtt' }),
    kind,
    name,
    alt,
    mime: 'text/vtt',
    width: null,
    height: null,
    durationSec: null,
  })
}

export function useUploadMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: prepareAndUpload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export function useUpdateAlt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) => mediaRepository.updateAlt(id, alt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export function useDeleteMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mediaRepository.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}
