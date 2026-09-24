import {
  activityEventSchema,
  clampOccurredAt,
  eventBatchSchema,
  MAX_EVENTS_PER_BATCH,
} from './index.ts'

const event = {
  clientEventId: '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  explorerId: '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
  kitId: '3f8a2c1e-5b7d-4e9a-8c6f-1d2e3f4a5b6c',
  stepId: 's-tohum-nedir',
  occurredAt: '2026-09-24T10:00:00.000Z',
  isPreview: false,
  type: 'card_complete',
  data: { durationMs: 45000, attempts: 1 },
} as const

describe('activity events', () => {
  it('accepts typed payloads per event type', () => {
    expect(activityEventSchema.safeParse(event).success).toBe(true)
    expect(
      activityEventSchema.safeParse({
        ...event,
        type: 'qr_scan',
        data: { code: 'KC-01', source: 'in-app' },
      }).success,
    ).toBe(true)
    expect(
      activityEventSchema.safeParse({ ...event, type: 'qr_scan', data: { code: 'KC-01' } }).success,
    ).toBe(false)
  })

  it('carries no personal fields (key allow-list)', () => {
    const parsed = activityEventSchema.parse(event)
    expect(Object.keys(parsed).toSorted()).toEqual(
      [
        'clientEventId',
        'data',
        'explorerId',
        'isPreview',
        'kitId',
        'occurredAt',
        'stepId',
        'type',
      ].toSorted(),
    )
    const withName = activityEventSchema.parse({ ...event, nickname: 'Ayşe' })
    expect(withName).not.toHaveProperty('nickname')
  })

  it('limits batch size', () => {
    expect(eventBatchSchema.safeParse([]).success).toBe(false)
    expect(
      eventBatchSchema.safeParse(Array.from({ length: MAX_EVENTS_PER_BATCH }, () => event)).success,
    ).toBe(true)
    expect(
      eventBatchSchema.safeParse(Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => event))
        .success,
    ).toBe(false)
  })

  it('clamps timestamps into the accepted window', () => {
    const now = new Date('2026-09-24T12:00:00.000Z')
    expect(clampOccurredAt('2026-09-24T11:00:00.000Z', now)).toBe('2026-09-24T11:00:00.000Z')
    expect(clampOccurredAt('2026-09-24T13:00:00.000Z', now)).toBe('2026-09-24T12:05:00.000Z')
    expect(clampOccurredAt('2026-09-10T11:00:00.000Z', now)).toBeNull()
    expect(clampOccurredAt('nope', now)).toBeNull()
  })
})
