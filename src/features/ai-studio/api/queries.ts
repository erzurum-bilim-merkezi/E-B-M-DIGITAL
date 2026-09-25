import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'

import { aiService } from './index'
import type { SceneSuggestion } from './port'

export const aiKeys = {
  all: [STUDIO_QUERY_ROOT, 'ai'] as const,
  quota: () => [...aiKeys.all, 'quota'] as const,
}

export function aiQuotaQueryOptions() {
  return queryOptions({
    queryKey: aiKeys.quota(),
    queryFn: () => aiService.quota(),
    staleTime: 15_000,
  })
}

/** Every generation consumes quota — refresh the counters afterwards. */
export function useRefreshAiQuota() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: aiKeys.quota() })
}

export function useSaveScene() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (suggestion: SceneSuggestion) => aiService.saveScene(suggestion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDIO_QUERY_ROOT, 'media'] }),
  })
}

export function useSaveAiIcon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ svg, concept }: { svg: string; concept: string }) =>
      aiService.saveIcon(svg, concept),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDIO_QUERY_ROOT, 'media'] }),
  })
}
