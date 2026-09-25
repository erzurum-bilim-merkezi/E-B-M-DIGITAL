import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { MAX_DURATION_MS } from '@/entities/activity'
import type { ExplorerProgress } from '@/entities/explorer'
import { KUCUK_CIFTCILER } from '@/entities/kit'
import { createTestQueryClient } from '@/test/test-utils'

import { progressService } from './index'
import { useKitCompletion } from './queries'
import { eventQueue } from './queue'

const EXPLORER_ID = '3e7c1b2a-5d4f-4a6b-9c8d-7e6f5a4b3c2d'
const DAY_MS = 24 * 60 * 60 * 1000

function finished(overrides: Partial<ExplorerProgress> = {}): ExplorerProgress {
  return {
    explorerId: EXPLORER_ID,
    kitId: KUCUK_CIFTCILER.id,
    startedAt: '2026-09-20T09:00:00.000Z',
    completedAt: null,
    completedSteps: KUCUK_CIFTCILER.steps.map((step) => step.id),
    qrScans: 1,
    totalDurationMs: 90_000,
    ...overrides,
  }
}

function renderCompletion(row: ExplorerProgress) {
  vi.spyOn(progressService, 'list').mockResolvedValue([row])
  const queryClient = createTestQueryClient()
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return renderHook(() => useKitCompletion(KUCUK_CIFTCILER, EXPLORER_ID), { wrapper: Wrapper })
}

function queuedCompletions() {
  return eventQueue.get().filter((event) => event.type === 'kit_complete')
}

describe('useKitCompletion', () => {
  afterEach(() => eventQueue.set([]))

  it('reports the finished kit once with the time spent on its cards', async () => {
    const { result, rerender } = renderCompletion(finished())
    await waitFor(() => expect(result.current.summary.done).toBe(true))
    await waitFor(() => expect(queuedCompletions()).toHaveLength(1))
    rerender()
    expect(queuedCompletions()).toHaveLength(1)
    expect(queuedCompletions()[0]).toMatchObject({
      kitId: KUCUK_CIFTCILER.id,
      data: { durationMs: 90_000 },
    })
  })

  it('reports a kit played over several days at the longest time an event may carry', async () => {
    renderCompletion(finished({ totalDurationMs: 3 * DAY_MS }))
    // Beyond the cap the event would fail validation and the kit would never count as done.
    await waitFor(() => expect(queuedCompletions()).toHaveLength(1))
    expect(queuedCompletions()[0]?.data).toEqual({ durationMs: MAX_DURATION_MS })
  })

  it('stays quiet when the completion is already known', async () => {
    const { result } = renderCompletion(finished({ completedAt: '2026-09-21T10:00:00.000Z' }))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(queuedCompletions()).toEqual([])
  })
})
