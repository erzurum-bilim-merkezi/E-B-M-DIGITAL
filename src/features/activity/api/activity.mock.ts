import { z } from 'zod'

import {
  clampOccurredAt,
  eventBatchSchema,
  storedEventSchema,
  type ActivityEvent,
  type StoredEvent,
} from '@/entities/activity'
import {
  earnedBadgeSchema,
  explorerProgressSchema,
  explorerSchema,
  kitBadgeId,
  newlyEarnedGlobalBadges,
  type EarnedBadge,
  type ExplorerProgress,
} from '@/entities/explorer'
import { qrCodeRowSchema } from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import { requireDevice } from '@/shared/api/mock-auth'
import { mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'

import type { EventSink, ProgressService } from './port'

export const eventsTable = mockTable(MOCK_TABLES.explorerEvents, storedEventSchema)
export const progressTable = mockTable(MOCK_TABLES.explorerProgress, explorerProgressSchema)
export const badgesTable = mockTable(MOCK_TABLES.explorerBadges, earnedBadgeSchema)
const explorersTable = mockTable(MOCK_TABLES.explorers, explorerSchema)
const devicesTable = mockTable(
  MOCK_TABLES.explorerDevices,
  z.object({
    explorerId: z.uuid(),
    deviceUid: z.uuid(),
    linkedAt: z.string(),
    lastSeenAt: z.string(),
  }),
)
const qrTable = mockTable(MOCK_TABLES.qrCodes, qrCodeRowSchema)
const rateTable = mockTable(
  MOCK_TABLES.rateLimits,
  z.object({ bucket: z.string(), subject: z.string(), windowStart: z.string(), count: z.int() }),
)

/** Per device and minute (`rate_limit_counters`). */
export const MAX_EVENTS_PER_MINUTE = 120

function linkedExplorers(deviceUid: string) {
  return new Set(
    devicesTable.filter((row) => row.deviceUid === deviceUid).map((row) => row.explorerId),
  )
}

function rateRowKey(row: { bucket: string; subject: string; windowStart: string }) {
  return `${row.bucket}:${row.subject}:${row.windowStart}`
}

function consumeRate(deviceUid: string, amount: number) {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
  const current = rateTable.find(
    (row) =>
      row.bucket === 'events' && row.subject === deviceUid && row.windowStart === windowStart,
  )
  const used = current?.count ?? 0
  if (used + amount > MAX_EVENTS_PER_MINUTE) throw new AppError('rate_limited')
  rateTable.upsert(
    { bucket: 'events', subject: deviceUid, windowStart, count: used + amount },
    rateRowKey,
  )
}

/** Kit and card ids must belong to a published kit (they are in the QR registry). */
function isKnownTarget(event: ActivityEvent) {
  if (event.kitId === null) return event.type === 'badge_earned'
  const rows = qrTable.filter((row) => row.kitId === event.kitId)
  if (rows.length === 0) return false
  return event.stepId === null || rows.some((row) => row.stepId === event.stepId)
}

function progressKey(row: ExplorerProgress) {
  return `${row.explorerId}:${row.kitId}`
}

function applyToProgress(event: ActivityEvent, occurredAt: string, newBadges: EarnedBadge[]) {
  if (!event.kitId) return
  const existing = progressTable.find(
    (row) => row.explorerId === event.explorerId && row.kitId === event.kitId,
  )
  const base: ExplorerProgress = existing ?? {
    explorerId: event.explorerId,
    kitId: event.kitId,
    startedAt: occurredAt,
    completedAt: null,
    completedSteps: [],
    qrScans: 0,
    totalDurationMs: 0,
  }
  const next: ExplorerProgress = {
    ...base,
    startedAt: Date.parse(occurredAt) < Date.parse(base.startedAt) ? occurredAt : base.startedAt,
  }
  switch (event.type) {
    case 'card_complete':
      if (event.stepId && !next.completedSteps.includes(event.stepId)) {
        next.completedSteps = [...next.completedSteps, event.stepId]
      }
      next.totalDurationMs += event.data.durationMs
      break
    case 'qr_scan':
      next.qrScans += 1
      break
    case 'kit_complete': {
      if (next.completedAt === null) next.completedAt = occurredAt
      const badgeId = kitBadgeId(event.kitId)
      if (
        !badgesTable.find((row) => row.explorerId === event.explorerId && row.badgeId === badgeId)
      ) {
        const badge = {
          explorerId: event.explorerId,
          badgeId,
          kitId: event.kitId,
          earnedAt: occurredAt,
        }
        badgesTable.insert(badge)
        newBadges.push(badge)
      }
      break
    }
    default:
      break
  }
  progressTable.upsert(next, progressKey)
}

function awardGlobalBadges(explorerId: string, occurredAt: string, newBadges: EarnedBadge[]) {
  const events = eventsTable.filter((row) => row.event.explorerId === explorerId)
  const correctQuizSteps = new Set(
    events
      .map((row) => row.event)
      .filter((event) => event.type === 'quiz_answer' && event.data.correct)
      .map((event) => `${event.kitId}:${event.stepId}`),
  )
  const counters = {
    qrScans: events.filter((row) => row.event.type === 'qr_scan').length,
    completedKits: progressTable.count(
      (row) => row.explorerId === explorerId && row.completedAt !== null,
    ),
    correctQuizAnswers: correctQuizSteps.size,
  }
  const earned = new Set(
    badgesTable.filter((row) => row.explorerId === explorerId).map((row) => row.badgeId),
  )
  for (const badgeId of newlyEarnedGlobalBadges(counters, earned)) {
    const badge = { explorerId, badgeId, kitId: null, earnedAt: occurredAt }
    badgesTable.insert(badge)
    newBadges.push(badge)
  }
}

/** `bigint identity` stand-in: always one above the current maximum (safe after imports/resets). */
function allocateEventId() {
  return eventsTable.all().reduce((max, row) => Math.max(max, row.id), 0) + 1
}

/** Server-side: badge events for the admin timeline. */
function badgeEvent(badge: EarnedBadge, isPreview: boolean): StoredEvent {
  const now = new Date().toISOString()
  return {
    id: allocateEventId(),
    receivedAt: now,
    event: {
      clientEventId: crypto.randomUUID(),
      explorerId: badge.explorerId,
      kitId: badge.kitId,
      stepId: null,
      occurredAt: badge.earnedAt,
      isPreview,
      type: 'badge_earned',
      data: { badgeId: badge.badgeId },
    },
  }
}

export function createMockEventSink(): EventSink {
  return {
    async send(input) {
      await mockGate('activity.send')
      const deviceUid = requireDevice()
      const parsed = eventBatchSchema.safeParse(input)
      if (!parsed.success) throw new AppError('validation', 'Olay paketi geçersiz.')
      consumeRate(deviceUid, parsed.data.length)

      const linked = linkedExplorers(deviceUid)
      const seen = new Set(eventsTable.all().map((row) => row.event.clientEventId))
      const now = new Date()
      const accepted: StoredEvent[] = []
      const newBadges: EarnedBadge[] = []
      const touched = new Map<string, { at: string; preview: boolean }>()
      let duplicates = 0
      let rejected = 0

      for (const event of parsed.data) {
        if (seen.has(event.clientEventId)) {
          duplicates++
          continue
        }
        const occurredAt = clampOccurredAt(event.occurredAt, now)
        if (
          !linked.has(event.explorerId) ||
          occurredAt === null ||
          !isKnownTarget(event) ||
          event.type === 'badge_earned'
        ) {
          rejected++
          continue
        }
        seen.add(event.clientEventId)
        const stored: StoredEvent = {
          id: allocateEventId(),
          receivedAt: now.toISOString(),
          event: { ...event, occurredAt },
        }
        eventsTable.insert(stored)
        accepted.push(stored)
        applyToProgress(stored.event, occurredAt, newBadges)
        touched.set(event.explorerId, { at: occurredAt, preview: event.isPreview })
      }

      for (const [explorerId, { at, preview }] of touched) {
        awardGlobalBadges(explorerId, at, newBadges)
        explorersTable.update(
          (row) => row.id === explorerId,
          (row) => ({ ...row, lastSeenAt: now.toISOString() }),
        )
        for (const badge of newBadges.filter((candidate) => candidate.explorerId === explorerId)) {
          eventsTable.insert(badgeEvent(badge, preview))
        }
      }
      return { accepted: accepted.length, duplicates, rejected, newBadges }
    },
  }
}

function requireLinked(explorerId: string) {
  const deviceUid = requireDevice()
  if (!linkedExplorers(deviceUid).has(explorerId))
    throw new AppError('forbidden', 'Bu kâşif bu cihaza bağlı değil.')
}

export function createMockProgressService(): ProgressService {
  return {
    async list(explorerId) {
      await mockGate('progress.list')
      requireLinked(explorerId)
      return progressTable.filter((row) => row.explorerId === explorerId)
    },
    async badges(explorerId) {
      await mockGate('progress.badges')
      requireLinked(explorerId)
      return badgesTable
        .filter((row) => row.explorerId === explorerId)
        .toSorted((a, b) => b.earnedAt.localeCompare(a.earnedAt))
    },
    async resetKit(explorerId, kitId) {
      await mockGate('progress.resetKit')
      requireLinked(explorerId)
      progressTable.update(
        (row) => row.explorerId === explorerId && row.kitId === kitId,
        (row) => ({ ...row, completedSteps: [], completedAt: null, totalDurationMs: 0 }),
      )
    },
  }
}
