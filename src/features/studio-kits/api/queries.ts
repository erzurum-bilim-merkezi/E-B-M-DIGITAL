import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import type { KitDocument, KitVisibility, StudioKit } from '@/entities/kit'
import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'

import { kitRepository, publishingService, qrRegistry } from './index'
import type { CreateKitInput, KitListFilter, PublishInput } from './port'

export const studioKitKeys = {
  all: [STUDIO_QUERY_ROOT, 'kits'] as const,
  lists: () => [...studioKitKeys.all, 'list'] as const,
  list: (filter: KitListFilter) => [...studioKitKeys.lists(), filter] as const,
  everything: () => [...studioKitKeys.all, 'all'] as const,
  detail: (id: string) => [...studioKitKeys.all, 'detail', id] as const,
  versions: (id: string) => [...studioKitKeys.all, 'versions', id] as const,
  qr: (id: string) => [...studioKitKeys.all, 'qr', id] as const,
  takenPrefixes: () => [...studioKitKeys.all, 'taken-prefixes'] as const,
}

export function kitListQueryOptions(filter: KitListFilter) {
  return queryOptions({
    queryKey: studioKitKeys.list(filter),
    queryFn: () => kitRepository.list(filter),
    placeholderData: keepPreviousData,
  })
}

export function allKitsQueryOptions() {
  return queryOptions({
    queryKey: studioKitKeys.everything(),
    queryFn: () => kitRepository.listAll(),
  })
}

/** Prefixes to leave out of suggestions (includes prefixes kept by renamed or deleted kits). */
export function takenQrPrefixesQueryOptions() {
  return queryOptions({
    queryKey: studioKitKeys.takenPrefixes(),
    queryFn: () => kitRepository.listTakenPrefixes(),
  })
}

export function kitQueryOptions(id: string) {
  return queryOptions({ queryKey: studioKitKeys.detail(id), queryFn: () => kitRepository.get(id) })
}

export function kitVersionsQueryOptions(id: string) {
  return queryOptions({
    queryKey: studioKitKeys.versions(id),
    queryFn: () => publishingService.listVersions(id),
  })
}

export function kitQrQueryOptions(id: string) {
  return queryOptions({ queryKey: studioKitKeys.qr(id), queryFn: () => qrRegistry.listForKit(id) })
}

/** After a kit changes, every Studio view (lists, dashboard, analytics, QR) may be stale. */
function useKitChanged() {
  const queryClient = useQueryClient()
  return (kit?: StudioKit) => {
    if (kit) queryClient.setQueryData(studioKitKeys.detail(kit.id), kit)
    return queryClient.invalidateQueries({
      queryKey: [STUDIO_QUERY_ROOT],
      predicate: (query) =>
        !(kit && query.queryKey.join('/') === studioKitKeys.detail(kit.id).join('/')),
    })
  }
}

export function useCreateKit() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: (input: CreateKitInput) => kitRepository.create(input),
    onSuccess: changed,
  })
}

/** Autosave: the editor keeps its own buffer; the cache gets the saved row. */
export function useSaveKit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      draft,
      lockVersion,
    }: {
      id: string
      draft: KitDocument
      lockVersion: number
    }) => kitRepository.update(id, draft, lockVersion),
    onSuccess: (kit) => {
      queryClient.setQueryData(studioKitKeys.detail(kit.id), kit)
      void queryClient.invalidateQueries({ queryKey: studioKitKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: studioKitKeys.everything() })
      void queryClient.invalidateQueries({ queryKey: studioKitKeys.qr(kit.id) })
    },
  })
}

export function useRenameKit() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({
      id,
      slug,
      qrPrefix,
      lockVersion,
    }: {
      id: string
      slug: string
      qrPrefix: string
      lockVersion: number
    }) => kitRepository.rename(id, slug, qrPrefix, lockVersion),
    onSuccess: changed,
  })
}

export function useDuplicateKit() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: (id: string) => kitRepository.duplicate(id),
    onSuccess: changed,
  })
}

export function useDeleteKit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kitRepository.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: studioKitKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: [STUDIO_QUERY_ROOT] })
    },
  })
}

export function useSubmitForReview() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({ id, lockVersion }: { id: string; lockVersion: number }) =>
      publishingService.submitForReview(id, lockVersion),
    onSuccess: changed,
  })
}

export function useWithdrawReview() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: (id: string) => publishingService.withdrawReview(id),
    onSuccess: changed,
  })
}

export function useRequestChanges() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      publishingService.requestChanges(id, note),
    onSuccess: changed,
  })
}

export function usePublishKit() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PublishInput }) =>
      publishingService.publish(id, input),
    onSuccess: ({ kit }) => changed(kit),
  })
}

export function useSetVisibility() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: KitVisibility }) =>
      publishingService.setVisibility(id, visibility),
    onSuccess: changed,
  })
}

export function useArchiveKit() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? publishingService.archive(id) : publishingService.unarchive(id),
    onSuccess: changed,
  })
}

export function useRestoreVersion() {
  const changed = useKitChanged()
  return useMutation({
    mutationFn: ({
      id,
      version,
      lockVersion,
    }: {
      id: string
      version: number
      lockVersion: number
    }) => publishingService.restoreToDraft(id, version, lockVersion),
    onSuccess: changed,
  })
}

export function useRegenerateSnapshots() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => publishingService.regenerateSnapshots(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
