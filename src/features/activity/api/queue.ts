import { z } from 'zod'

import {
  activityEventSchema,
  type eventDataSchemas,
  MAX_EVENTS_PER_BATCH,
  type ActivityEvent,
  type ActivityType,
} from '@/entities/activity'
import type { EarnedBadge } from '@/entities/explorer'
import { isAppError } from '@/shared/api/errors'
import { previewDevice } from '@/shared/config/device-flags'
import { createStoredValue } from '@/shared/hooks/stored-value'

import type { EventSink } from './port'

/**
 * Offline-tolerant event queue (ADR 0012): events are written locally first, then sent in
 * batches of ≤ 50 when online. `clientEventId` makes resends harmless; the oldest events are
 * dropped beyond 500 so a device offline for weeks cannot grow without bound.
 */
export const MAX_QUEUE_LENGTH = 500

export const eventQueue = createStoredValue(
  'kasif:activity-queue:v1',
  z.array(activityEventSchema),
  [],
)

type FlushListener = (result: { sent: number; newBadges: EarnedBadge[] }) => void
const listeners = new Set<FlushListener>()

export function onFlushed(listener: FlushListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let sink: EventSink | null = null
let flushing = false
let retryTimer: number | undefined
let backoffMs = 0
let enabled = true

export function configureQueue(options: { sink: EventSink; enabled?: boolean }) {
  sink = options.sink
  enabled = options.enabled ?? true
}

/** Studio previews and tests can switch tracking off entirely. */
export function setTrackingEnabled(value: boolean) {
  enabled = value
}

type EventInput<T extends ActivityType> = {
  type: T
  explorerId: string
  kitId: string | null
  stepId: string | null
  data: z.input<(typeof eventDataSchemas)[T]>
}

export function track<T extends ActivityType>(input: EventInput<T>) {
  if (!enabled) return
  const candidate = {
    clientEventId: crypto.randomUUID(),
    explorerId: input.explorerId,
    kitId: input.kitId,
    stepId: input.stepId,
    occurredAt: new Date().toISOString(),
    isPreview: previewDevice.get(),
    type: input.type,
    data: input.data,
  }
  const parsed = activityEventSchema.safeParse(candidate)
  if (!parsed.success) return
  eventQueue.set([...eventQueue.get(), parsed.data].slice(-MAX_QUEUE_LENGTH))
  scheduleFlush(300)
}

export function scheduleFlush(delayMs = 0) {
  window.clearTimeout(retryTimer)
  retryTimer = window.setTimeout(() => void flushQueue(), delayMs)
}

export async function flushQueue() {
  if (flushing || !sink || typeof navigator === 'undefined' || !navigator.onLine) return
  flushing = true
  let sent = 0
  const newBadges: EarnedBadge[] = []
  try {
    for (;;) {
      const batch = eventQueue.get().slice(0, MAX_EVENTS_PER_BATCH)
      if (batch.length === 0) break
      try {
        // oxlint-disable-next-line no-await-in-loop -- batches go out one at a time, oldest first (queue order, server rate limit)
        const result = await sink.send(batch)
        newBadges.push(...result.newBadges)
        sent += batch.length
      } catch (error) {
        // A batch the server can never accept (e.g. a deleted member) must not block the queue.
        if (!(isAppError(error) && (error.code === 'validation' || error.code === 'forbidden')))
          throw error
      }
      const done = new Set(batch.map((event) => event.clientEventId))
      eventQueue.set(eventQueue.get().filter((event) => !done.has(event.clientEventId)))
    }
    backoffMs = 0
    if (sent > 0) for (const listener of listeners) listener({ sent, newBadges })
  } catch {
    backoffMs = Math.min(60_000, backoffMs ? backoffMs * 2 : 2_000)
    scheduleFlush(backoffMs)
  } finally {
    flushing = false
  }
}

/** Unsent events of one member (for optimistic progress while offline). */
export function pendingEvents(queue: readonly ActivityEvent[], explorerId: string) {
  return queue.filter((event) => event.explorerId === explorerId)
}
