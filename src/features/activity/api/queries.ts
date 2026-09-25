import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import type { ActivityEvent } from '@/entities/activity'
import { mergeProgress, type EarnedBadge, type ExplorerProgress } from '@/entities/explorer'
import { isKitComplete, kitProgressRatio, type KitDocument } from '@/entities/kit'
import { KIDS_QUERY_ROOT } from '@/shared/api/query-keys'

import { progressService } from './index'
import { eventQueue, flushQueue, onFlushed, pendingEvents } from './queue'

export const progressKeys = {
  all: [KIDS_QUERY_ROOT, 'progress'] as const,
  list: (explorerId: string) => [...progressKeys.all, 'list', explorerId] as const,
  badges: (explorerId: string) => [...progressKeys.all, 'badges', explorerId] as const,
}

export function progressQueryOptions(explorerId: string) {
  return queryOptions({
    queryKey: progressKeys.list(explorerId),
    queryFn: () => progressService.list(explorerId),
    networkMode: 'offlineFirst',
  })
}

export function badgesQueryOptions(explorerId: string) {
  return queryOptions({
    queryKey: progressKeys.badges(explorerId),
    queryFn: () => progressService.badges(explorerId),
    networkMode: 'offlineFirst',
  })
}

/** Progress implied by events that are still waiting in the queue (offline). */
function optimisticProgress(explorerId: string, events: readonly ActivityEvent[]) {
  const byKit = new Map<string, ExplorerProgress>()
  for (const event of events) {
    if (!event.kitId) continue
    const current = byKit.get(event.kitId) ?? {
      explorerId,
      kitId: event.kitId,
      startedAt: event.occurredAt,
      completedAt: null,
      completedSteps: [],
      qrScans: 0,
      totalDurationMs: 0,
    }
    if (
      event.type === 'card_complete' &&
      event.stepId &&
      !current.completedSteps.includes(event.stepId)
    ) {
      current.completedSteps = [...current.completedSteps, event.stepId]
    }
    if (event.type === 'kit_complete' && current.completedAt === null)
      current.completedAt = event.occurredAt
    if (event.type === 'qr_scan') current.qrScans += 1
    byKit.set(event.kitId, current)
  }
  return byKit
}

/** Server progress merged with not-yet-sent events: ✓ marks never wait for the network. */
export function useExplorerProgress(explorerId: string | null | undefined) {
  const query = useQuery({
    ...progressQueryOptions(explorerId ?? ''),
    enabled: Boolean(explorerId),
  })
  const queue = eventQueue.useValue()
  const merged = useMemo(() => {
    const map = new Map<string, ExplorerProgress>()
    for (const row of query.data ?? []) map.set(row.kitId, row)
    if (explorerId) {
      for (const [kitId, local] of optimisticProgress(
        explorerId,
        pendingEvents(queue, explorerId),
      )) {
        const server = map.get(kitId)
        map.set(kitId, server ? mergeProgress(server, local) : local)
      }
    }
    return map
  }, [explorerId, query.data, queue])
  return {
    progress: merged,
    isPending: Boolean(explorerId) && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function kitProgressSummary(
  kit: Pick<KitDocument, 'steps'>,
  progress: ExplorerProgress | undefined,
) {
  const completed = new Set(progress?.completedSteps ?? [])
  return {
    completedStepIds: completed,
    ratio: kitProgressRatio(kit, completed),
    done: isKitComplete(kit, completed),
    completedCount: kit.steps.filter((step) => completed.has(step.id)).length,
  }
}

export function useExplorerBadges(explorerId: string | null | undefined) {
  return useQuery({ ...badgesQueryOptions(explorerId ?? ''), enabled: Boolean(explorerId) })
}

export function useResetKitProgress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ explorerId, kitId }: { explorerId: string; kitId: string }) =>
      progressService.resetKit(explorerId, kitId),
    onSuccess: (_, { explorerId, kitId }) => {
      // Unsent completions of that kit would re-complete it — drop them too.
      eventQueue.set(
        eventQueue
          .get()
          .filter(
            (event) =>
              !(
                event.explorerId === explorerId &&
                event.kitId === kitId &&
                event.type === 'card_complete'
              ),
          ),
      )
      return queryClient.invalidateQueries({ queryKey: progressKeys.all })
    },
  })
}

/**
 * Keeps the queue flowing: flushes on mount, when the device comes online and on an interval,
 * then refreshes progress/badges and reports newly earned badges.
 */
export function useActivitySync(onNewBadges?: (badges: EarnedBadge[]) => void) {
  const queryClient = useQueryClient()
  useEffect(() => {
    void flushQueue()
    const onOnline = () => void flushQueue()
    window.addEventListener('online', onOnline)
    const timer = window.setInterval(() => void flushQueue(), 20_000)
    const unsubscribe = onFlushed(({ newBadges }) => {
      void queryClient.invalidateQueries({ queryKey: progressKeys.all })
      if (newBadges.length > 0) onNewBadges?.(newBadges)
    })
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [onNewBadges, queryClient])
}
