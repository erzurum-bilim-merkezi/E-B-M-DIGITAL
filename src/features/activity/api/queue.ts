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
 * batches of ≤ 50 when online. `clientEventId` makes resends harmless. Beyond 500 events the
 * oldest are dropped — completions last — so a device offline for weeks cannot grow unbounded.
 */
export const MAX_QUEUE_LENGTH = 500

/** Events that make progress: a full queue drops every other kind first. */
const PROGRESS_EVENTS = new Set<ActivityType>(['card_complete', 'kit_complete'])

/** The queue within its limit: the oldest other events go first, then the oldest of all. */
export function capQueue(events: readonly ActivityEvent[], max = MAX_QUEUE_LENGTH) {
  let excess = events.length - max
  if (excess <= 0) return [...events]
  const kept = events.filter((event) => {
    if (excess > 0 && !PROGRESS_EVENTS.has(event.type)) {
      excess -= 1
      return false
    }
    return true
  })
  return excess > 0 ? kept.slice(excess) : kept
}

export const eventQueue = createStoredValue(
  'kasif:activity-queue:v1',
  z.array(activityEventSchema),
  [],
)

/**
 * Called for every batch the server accepted, right before it leaves the queue: whatever shows
 * progress can take the events over first, so nothing looks undone while fresh progress loads.
 */
type FlushListener = (result: { events: ActivityEvent[]; newBadges: EarnedBadge[] }) => void
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
  eventQueue.set(capQueue([...eventQueue.get(), parsed.data]))
  scheduleFlush(300)
}

export function scheduleFlush(delayMs = 0) {
  window.clearTimeout(retryTimer)
  retryTimer = window.setTimeout(() => void flushQueue(), delayMs)
}

export async function flushQueue() {
  if (flushing || !sink || typeof navigator === 'undefined' || !navigator.onLine) return
  flushing = true
  try {
    for (;;) {
      const batch = eventQueue.get().slice(0, MAX_EVENTS_PER_BATCH)
      if (batch.length === 0) break
      try {
        // oxlint-disable-next-line no-await-in-loop -- batches go out one at a time, oldest first (queue order, server rate limit)
        const result = await sink.send(batch)
        for (const listener of listeners) {
          // A failing listener must not resend the batch forever and stall the queue.
          try {
            listener({ events: batch, newBadges: result.newBadges })
          } catch (error) {
            console.error(error)
          }
        }
      } catch (error) {
        // A batch the server can never accept (e.g. a deleted member) must not block the queue.
        if (!(isAppError(error) && (error.code === 'validation' || error.code === 'forbidden')))
          throw error
      }
      const done = new Set(batch.map((event) => event.clientEventId))
      eventQueue.set(eventQueue.get().filter((event) => !done.has(event.clientEventId)))
    }
    backoffMs = 0
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
