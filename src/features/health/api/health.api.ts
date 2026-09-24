import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/shared/api/http-client'

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string().optional(),
})

export type Health = z.infer<typeof healthSchema>

export const healthKeys = {
  all: ['health'] as const,
}

export function getHealth(signal?: AbortSignal) {
  return apiClient.get('/health', healthSchema, signal ? { signal } : undefined)
}

export function healthQueryOptions() {
  return queryOptions({
    queryKey: healthKeys.all,
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 30_000,
    retry: false,
  })
}
