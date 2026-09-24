import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Explorer } from '@/entities/explorer'
import { KIDS_QUERY_ROOT } from '@/shared/api/query-keys'

import { activeExplorerId, forgetAllCodes, knownCodes } from './device'
import { explorerService } from './index'
import type { ExplorerPatch, RegisterInput } from './port'

export const explorerKeys = {
  all: [KIDS_QUERY_ROOT, 'explorers'] as const,
  device: () => [...explorerKeys.all, 'device'] as const,
}

export function deviceExplorersQueryOptions() {
  return queryOptions({
    queryKey: explorerKeys.device(),
    queryFn: () => explorerService.listOnDevice(),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  })
}

/** The member currently using the app on this device (null = show the welcome flow). */
export function useActiveExplorer() {
  const activeId = activeExplorerId.useValue()
  const query = useQuery(deviceExplorersQueryOptions())
  const explorer = query.data?.find((candidate) => candidate.id === activeId) ?? null
  return {
    explorer,
    explorers: query.data ?? [],
    activeId,
    isPending: activeId !== null && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useExplorerCode(explorerId: string | undefined) {
  const codes = knownCodes.useValue()
  return explorerId ? (codes[explorerId] ?? null) : null
}

function setDeviceExplorer(queryClient: ReturnType<typeof useQueryClient>, explorer: Explorer) {
  queryClient.setQueryData<Explorer[]>(explorerKeys.device(), (current = []) => [
    ...current.filter((candidate) => candidate.id !== explorer.id),
    explorer,
  ])
}

export function useRegisterExplorer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => explorerService.register(input),
    onSuccess: ({ explorer }) => {
      setDeviceExplorer(queryClient, explorer)
      activeExplorerId.set(explorer.id)
      // Ask the browser to keep this origin's data (iOS may still evict it — the code restores).
      void navigator.storage?.persist?.().catch(() => false)
    },
  })
}

export function useRestoreExplorer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => explorerService.restore(code),
    onSuccess: ({ explorer }) => {
      setDeviceExplorer(queryClient, explorer)
      activeExplorerId.set(explorer.id)
      void queryClient.invalidateQueries({ queryKey: [KIDS_QUERY_ROOT] })
    },
  })
}

export function useUpdateExplorer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ExplorerPatch }) =>
      explorerService.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: explorerKeys.device() })
      const previous = queryClient.getQueryData<Explorer[]>(explorerKeys.device())
      queryClient.setQueryData<Explorer[]>(explorerKeys.device(), (current = []) =>
        current.map((explorer) => (explorer.id === id ? { ...explorer, ...patch } : explorer)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(explorerKeys.device(), context.previous)
    },
    onSuccess: (explorer) => setDeviceExplorer(queryClient, explorer),
  })
}

export function useRenewCode() {
  return useMutation({ mutationFn: (explorerId: string) => explorerService.renewCode(explorerId) })
}

export function useSwitchExplorer() {
  return (explorerId: string | null) => activeExplorerId.set(explorerId)
}

export function useUnlinkExplorer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (explorerId: string) => explorerService.unlink(explorerId),
    onSuccess: (_, explorerId) => {
      queryClient.setQueryData<Explorer[]>(explorerKeys.device(), (current = []) =>
        current.filter((explorer) => explorer.id !== explorerId),
      )
      if (activeExplorerId.get() === explorerId) activeExplorerId.set(null)
    },
  })
}

/**
 * Centre tablet hand-over: every member linked to this device is unlinked and nothing of them
 * (active member, restore codes) stays on it. The device-local part runs first, so it also
 * happens while the tablet is offline.
 */
export function useHandOverDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => explorerService.unlinkAll(),
    onMutate: () => {
      activeExplorerId.set(null)
      forgetAllCodes()
      queryClient.setQueryData<Explorer[]>(explorerKeys.device(), [])
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: explorerKeys.device() }),
  })
}

export function useDeleteMembership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (explorerId: string) => explorerService.deleteMembership(explorerId),
    onSuccess: (_, explorerId) => {
      queryClient.setQueryData<Explorer[]>(explorerKeys.device(), (current = []) =>
        current.filter((explorer) => explorer.id !== explorerId),
      )
      if (activeExplorerId.get() === explorerId) activeExplorerId.set(null)
      void queryClient.invalidateQueries({ queryKey: [KIDS_QUERY_ROOT] })
    },
  })
}
