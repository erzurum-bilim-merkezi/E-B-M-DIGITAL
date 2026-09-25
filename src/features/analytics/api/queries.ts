import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'

import { analyticsReader } from './index'
import type { DayRange, ExplorerFilter } from './port'

export const analyticsKeys = {
  all: [STUDIO_QUERY_ROOT, 'analytics'] as const,
  dashboard: () => [...analyticsKeys.all, 'dashboard'] as const,
  kit: (kitId: string, range: DayRange) => [...analyticsKeys.all, 'kit', kitId, range] as const,
  explorers: (filter: ExplorerFilter) => [...analyticsKeys.all, 'explorers', filter] as const,
  explorer: (id: string) => [...analyticsKeys.all, 'explorer', id] as const,
  overview: (range: DayRange) => [...analyticsKeys.all, 'overview', range] as const,
}

/** The dashboard refreshes every 30 s (live activity feed). */
export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: analyticsKeys.dashboard(),
    queryFn: () => analyticsReader.dashboard(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

export function kitStatsQueryOptions(kitId: string, range: DayRange) {
  return queryOptions({
    queryKey: analyticsKeys.kit(kitId, range),
    queryFn: () => analyticsReader.kitStats(kitId, range),
    placeholderData: keepPreviousData,
  })
}

export function explorersQueryOptions(filter: ExplorerFilter) {
  return queryOptions({
    queryKey: analyticsKeys.explorers(filter),
    queryFn: () => analyticsReader.explorers(filter),
    placeholderData: keepPreviousData,
  })
}

export function explorerDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: analyticsKeys.explorer(id),
    queryFn: () => analyticsReader.explorerDetail(id),
  })
}

export function overviewQueryOptions(range: DayRange) {
  return queryOptions({
    queryKey: analyticsKeys.overview(range),
    queryFn: () => analyticsReader.overview(range),
    placeholderData: keepPreviousData,
  })
}

export function useDeleteExplorer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => analyticsReader.deleteExplorer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDIO_QUERY_ROOT] }),
  })
}
