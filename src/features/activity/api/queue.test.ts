import type { ActivityEvent } from '@/entities/activity'

import { capQueue } from './queue'

function event(index: number, type: ActivityEvent['type']): ActivityEvent {
  const base = {
    clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    explorerId: '3e7c1b2a-5d4f-4a6b-9c8d-7e6f5a4b3c2d',
    kitId: '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f',
    stepId: 's-1',
    occurredAt: '2026-09-28T10:00:00.000Z',
    isPreview: false,
  }
  switch (type) {
    case 'card_complete':
      return { ...base, type, data: { durationMs: 1000, attempts: 1 } }
    case 'kit_complete':
      return { ...base, type, stepId: null, data: { durationMs: 5000 } }
    default:
      return { ...base, type: 'card_open', data: {} }
  }
}

const ids = (events: ActivityEvent[]) => events.map((item) => Number(item.clientEventId.slice(-3)))

describe('capQueue', () => {
  it('keeps a queue within its limit as it is', () => {
    const events = [event(1, 'card_open'), event(2, 'card_complete')]
    expect(capQueue(events, 5)).toEqual(events)
  })

  it('drops the oldest other events before any completion', () => {
    const events = [
      event(1, 'card_complete'),
      event(2, 'card_open'),
      event(3, 'kit_complete'),
      event(4, 'card_open'),
      event(5, 'card_open'),
    ]
    expect(ids(capQueue(events, 3))).toEqual([1, 3, 5])
  })

  it('drops the oldest completions only when nothing else is left', () => {
    const events = [
      event(1, 'card_complete'),
      event(2, 'card_complete'),
      event(3, 'card_open'),
      event(4, 'kit_complete'),
    ]
    expect(ids(capQueue(events, 2))).toEqual([2, 4])
  })
})
