import { z } from 'zod'

/**
 * Activity events written by the Kâşif app (ADR 0012). Deliberately free of personal data:
 * no names, no location, no device model — only ids, event type and small numeric payloads.
 */
export const ACTIVITY_TYPES = [
  'qr_scan',
  'kit_open',
  'card_open',
  'card_complete',
  'quiz_answer',
  'kit_complete',
  'badge_earned',
  'certificate_view',
] as const
export const activityTypeSchema = z.enum(ACTIVITY_TYPES)
export type ActivityType = z.infer<typeof activityTypeSchema>

export const QR_SCAN_SOURCES = ['camera-link', 'in-app', 'manual'] as const
export const qrScanSourceSchema = z.enum(QR_SCAN_SOURCES)
export type QrScanSource = z.infer<typeof qrScanSourceSchema>

export const QR_SCAN_SOURCE_LABELS: Record<QrScanSource, string> = {
  'camera-link': 'Telefon kamerası',
  'in-app': 'Uygulama içi',
  manual: 'Elle yazılan kod',
}

const MAX_DURATION_MS = 6 * 60 * 60 * 1000

export const eventDataSchemas = {
  qr_scan: z.object({ code: z.string().max(12), source: qrScanSourceSchema }),
  kit_open: z.object({}),
  card_open: z.object({}),
  card_complete: z.object({
    durationMs: z.int().min(0).max(MAX_DURATION_MS),
    attempts: z.int().min(0).max(1000),
  }),
  quiz_answer: z.object({ correct: z.boolean(), optionId: z.string().max(40) }),
  kit_complete: z.object({ durationMs: z.int().min(0).max(MAX_DURATION_MS) }),
  badge_earned: z.object({ badgeId: z.string().max(80) }),
  certificate_view: z.object({}),
} satisfies Record<ActivityType, z.ZodType>

const eventBase = {
  clientEventId: z.uuid(),
  explorerId: z.uuid(),
  kitId: z.uuid().nullable(),
  stepId: z.string().max(40).nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
  /** Preview device events stay out of totals and are deleted after 24 h. */
  isPreview: z.boolean(),
}

export const activityEventSchema = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('qr_scan'), data: eventDataSchemas.qr_scan }),
  z.object({ ...eventBase, type: z.literal('kit_open'), data: eventDataSchemas.kit_open }),
  z.object({ ...eventBase, type: z.literal('card_open'), data: eventDataSchemas.card_open }),
  z.object({
    ...eventBase,
    type: z.literal('card_complete'),
    data: eventDataSchemas.card_complete,
  }),
  z.object({ ...eventBase, type: z.literal('quiz_answer'), data: eventDataSchemas.quiz_answer }),
  z.object({ ...eventBase, type: z.literal('kit_complete'), data: eventDataSchemas.kit_complete }),
  z.object({ ...eventBase, type: z.literal('badge_earned'), data: eventDataSchemas.badge_earned }),
  z.object({
    ...eventBase,
    type: z.literal('certificate_view'),
    data: eventDataSchemas.certificate_view,
  }),
])
export type ActivityEvent = z.infer<typeof activityEventSchema>
export type ActivityEventOf<T extends ActivityType> = Extract<ActivityEvent, { type: T }>

/** `explorer_events` row: the client event plus server bookkeeping. */
export const storedEventSchema = z.object({
  id: z.int().positive(),
  receivedAt: z.iso.datetime({ offset: true }),
  event: activityEventSchema,
})
export type StoredEvent = z.infer<typeof storedEventSchema>

/** Server limit per `record_events` call. */
export const MAX_EVENTS_PER_BATCH = 50
/** Events older than this are rejected by the server (offline queues are flushed sooner). */
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** Clock skew tolerated for events "from the future". */
export const MAX_EVENT_SKEW_MS = 5 * 60 * 1000

export const eventBatchSchema = z.array(activityEventSchema).min(1).max(MAX_EVENTS_PER_BATCH)

/** Clamps a client timestamp into the accepted window, like the `record_events` RPC. */
export function clampOccurredAt(occurredAt: string, now: Date) {
  const time = Date.parse(occurredAt)
  const min = now.getTime() - MAX_EVENT_AGE_MS
  const max = now.getTime() + MAX_EVENT_SKEW_MS
  if (Number.isNaN(time) || time < min) return null
  return new Date(Math.min(time, max)).toISOString()
}
