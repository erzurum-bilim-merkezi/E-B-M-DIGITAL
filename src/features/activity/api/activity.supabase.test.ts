import type { ActivityEvent } from '@/entities/activity'
import { isAppError } from '@/shared/api/errors'
import { resetSupabase, rpc, rpcError, signedInDevice, table } from '@/test/supabase'

import { createSupabaseEventSink, createSupabaseProgressService } from './activity.supabase'

const sink = createSupabaseEventSink()
const progress = createSupabaseProgressService()

const EXPLORER = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
const KIT = '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'

function cardComplete(): ActivityEvent {
  return {
    clientEventId: crypto.randomUUID(),
    explorerId: EXPLORER,
    kitId: KIT,
    stepId: 's-tohum',
    occurredAt: new Date().toISOString(),
    isPreview: false,
    type: 'card_complete',
    data: { durationMs: 1200, attempts: 1 },
  }
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

afterEach(resetSupabase)

describe('Supabase event sink', () => {
  it('sends a batch to record_events and returns the new badges', async () => {
    signedInDevice()
    const badge = {
      explorerId: EXPLORER,
      badgeId: `kit:${KIT}`,
      kitId: KIT,
      earnedAt: '2026-09-25T10:00:00+00:00',
    }
    const calls = rpc('record_events', () => ({
      accepted: 1,
      duplicates: 0,
      rejected: 0,
      newBadges: [badge],
    }))
    const event = cardComplete()

    const result = await sink.send([event])

    expect(calls).toEqual([{ p_events: [event] }])
    expect(result.newBadges).toEqual([badge])
  })

  it('never sends a malformed batch', async () => {
    const error = await failure(sink.send([{ ...cardComplete(), clientEventId: 'nope' }]))
    expect(isAppError(error, 'validation')).toBe(true)
  })

  it('passes the server rate limit on as rate_limited (the queue retries later)', async () => {
    signedInDevice()
    rpcError('record_events', 'KS429', 'Çok fazla deneme yapıldı.')
    expect(isAppError(await failure(sink.send([cardComplete()])), 'rate_limited')).toBe(true)
  })
})

describe('Supabase progress service', () => {
  it('reads the progress of a member linked to this device', async () => {
    signedInDevice()
    const row = {
      explorerId: EXPLORER,
      kitId: KIT,
      startedAt: '2026-09-25T10:00:00+00:00',
      completedAt: null,
      completedSteps: ['s-tohum'],
      qrScans: 1,
      totalDurationMs: 1200,
    }
    const queries = table('explorer_kit_progress', [row])
    expect(await progress.list(EXPLORER)).toEqual([row])
    expect(queries[0]?.get('explorer_id')).toBe(`eq.${EXPLORER}`)
  })

  it('has nothing to show before the device signed in', async () => {
    expect(await progress.list(EXPLORER)).toEqual([])
    expect(await progress.badges(EXPLORER)).toEqual([])
  })

  it('starts a kit over through the RPC', async () => {
    signedInDevice()
    const calls = rpc('reset_kit_progress', () => null)
    await progress.resetKit(EXPLORER, KIT)
    expect(calls).toEqual([{ p_explorer: EXPLORER, p_kit: KIT }])
  })
})
