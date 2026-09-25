/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

const db = setupTestDb()

const KIT = '11111111-1111-4111-8111-111111111111'
const CARDS = ['s-bir', 's-iki', 's-uc']

type SendResult = {
  accepted: number
  duplicates: number
  rejected: number
  newBadges: { explorerId: string; badgeId: string; kitId: string | null }[]
}

/** A published kit: its codes are in the QR registry. */
async function publishedKit() {
  await db().sql(
    `insert into public.kits (id, slug, qr_prefix, status, draft)
     values ($1::uuid, 'deneme', 'DN', 'published', jsonb_build_object('id', $2::text, 'slug', 'deneme', 'qrPrefix', 'DN'))`,
    [KIT, KIT],
  )
  await db().sql(`insert into public.qr_codes (code, kit_id, step_id) values ('DN', $1, null)`, [
    KIT,
  ])
  for (const [index, step] of CARDS.entries()) {
    await db().sql(`insert into public.qr_codes (code, kit_id, step_id) values ($1, $2, $3)`, [
      `DN-0${index + 1}`,
      KIT,
      step,
    ])
  }
}

async function member(device: Actor) {
  const { explorer } = await db()
    .as(device)
    .rpc<{ explorer: { id: string } }>('register_explorer', { p_nickname: 'Ali', p_avatar: 'leaf' })
  return explorer.id
}

function event(
  explorerId: string,
  type: string,
  data: object,
  extra: Record<string, unknown> = {},
) {
  return {
    clientEventId: crypto.randomUUID(),
    explorerId,
    kitId: KIT,
    stepId: null,
    occurredAt: new Date().toISOString(),
    isPreview: false,
    type,
    data,
    ...extra,
  }
}

const complete = (explorerId: string, stepId: string) =>
  event(explorerId, 'card_complete', { durationMs: 1000, attempts: 1 }, { stepId })

async function send(device: Actor, events: object[]) {
  return db().as(device).rpc<SendResult>('record_events', { p_events: events })
}

async function progress(device: Actor) {
  return db()
    .as(device)
    .sql<{ completed_steps: string[]; completed_at: string | null; qr_scans: number }>(
      'select completed_steps, completed_at, qr_scans from public.explorer_kit_progress',
    )
}

describe('record_events', () => {
  beforeEach(publishedKit)

  it('stores events, updates progress and awards the kit badge once', async () => {
    const device = await db().createDevice()
    const id = await member(device)

    const result = await send(device, [
      event(id, 'qr_scan', { code: 'DN-01', source: 'in-app' }, { stepId: 's-bir' }),
      ...CARDS.map((step) => complete(id, step)),
      event(id, 'kit_complete', { durationMs: 3000 }),
    ])

    expect(result).toMatchObject({ accepted: 5, duplicates: 0, rejected: 0 })
    expect(result.newBadges.map((badge) => badge.badgeId).toSorted()).toEqual([
      'first-qr',
      `kit:${KIT}`,
    ])
    const [row] = await progress(device)
    expect(row).toMatchObject({ completed_steps: CARDS, qr_scans: 1 })
    expect(row?.completed_at).not.toBeNull()

    // Completing again awards nothing new.
    const again = await send(device, [event(id, 'kit_complete', { durationMs: 10 })])
    expect(again.newBadges).toEqual([])
  })

  it('is idempotent: a batch sent twice (offline retry) counts once', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    const batch = [complete(id, 's-bir')]
    await send(device, batch)
    expect(await send(device, batch)).toMatchObject({ accepted: 0, duplicates: 1 })
  })

  it('rejects events of unlinked members, unknown cards, too old events and badge_earned', async () => {
    const device = await db().createDevice()
    const stranger = await db().createDevice()
    const id = await member(device)
    const other = await member(stranger)
    const old = new Date(Date.now() - 8 * 24 * 3600_000).toISOString()

    const result = await send(device, [
      complete(other, 's-bir'),
      complete(id, 's-yok'),
      event(id, 'card_open', {}, { kitId: crypto.randomUUID() }),
      complete(id, 's-iki'),
      event(id, 'card_open', {}, { occurredAt: old }),
      event(id, 'badge_earned', { badgeId: 'quiz-master' }),
    ])

    expect(result).toMatchObject({ accepted: 1, rejected: 5 })
  })

  it('clamps timestamps from the future to five minutes ahead', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    const future = new Date(Date.now() + 3600_000).toISOString()
    await send(device, [event(id, 'card_open', {}, { occurredAt: future })])
    const [row] = await db().sql<{ ahead: boolean }>(
      `select occurred_at <= now() + interval '5 minutes' as ahead from public.explorer_events
       where type = 'card_open'`,
    )
    expect(row?.ahead).toBe(true)
  })

  it('refuses a malformed batch as a whole', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    const bad = event(id, 'card_complete', { durationMs: -5, attempts: 1 }, { stepId: 's-bir' })
    expect((await dbError(send(device, [complete(id, 's-iki'), bad]))).code).toBe(KS.validation)
    expect((await dbError(send(device, []))).code).toBe(KS.validation)
    const tooMany = Array.from({ length: 51 }, () => complete(id, 's-bir'))
    expect((await dbError(send(device, tooMany))).code).toBe(KS.validation)
  })

  it('limits a device to 120 events per minute', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    for (let batch = 0; batch < 2; batch++) {
      await send(
        device,
        Array.from({ length: 50 }, () => event(id, 'card_open', {})),
      )
    }
    await send(
      device,
      Array.from({ length: 20 }, () => event(id, 'card_open', {})),
    )
    expect((await dbError(send(device, [event(id, 'card_open', {})]))).code).toBe(KS.rate_limited)
  })

  it('awards quiz-master for five different correctly answered questions', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    const answer = (stepId: string) =>
      event(id, 'quiz_answer', { correct: true, optionId: 'a' }, { stepId })
    // The same question twice counts once.
    const first = await send(device, [answer('s-bir'), answer('s-bir'), answer('s-iki')])
    expect(first.newBadges).toEqual([])

    await db().sql(
      `insert into public.qr_codes (code, kit_id, step_id) values
       ('DN-04', $1, 's-dort'), ('DN-05', $1, 's-bes'), ('DN-06', $1, 's-alti')`,
      [KIT],
    )
    const second = await send(device, [answer('s-uc'), answer('s-dort'), answer('s-bes')])
    expect(second.newBadges.map((badge) => badge.badgeId)).toEqual(['quiz-master'])
  })

  it('is for Kâşif devices only', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    expect((await dbError(send(editor, [{}]))).code).toBe(KS.unauthorized)
  })
})

describe('progress', () => {
  beforeEach(publishedKit)

  it('shows a device the progress and badges of its own members only', async () => {
    const device = await db().createDevice()
    const stranger = await db().createDevice()
    const id = await member(device)
    await send(device, [complete(id, 's-bir'), event(id, 'kit_complete', { durationMs: 1 })])

    expect(await progress(device)).toHaveLength(1)
    expect(await progress(stranger)).toEqual([])
    const badges = await db().as(stranger).sql('select * from public.explorer_badges')
    expect(badges).toEqual([])
    // Raw events are for admins only.
    expect(await db().as(device).sql('select * from public.explorer_events')).toEqual([])
  })

  it('starts a kit over but keeps the badges', async () => {
    const device = await db().createDevice()
    const id = await member(device)
    await send(device, [complete(id, 's-bir'), event(id, 'kit_complete', { durationMs: 1 })])

    await db().as(device).rpc('reset_kit_progress', { p_explorer: id, p_kit: KIT })

    const [row] = await progress(device)
    expect(row).toMatchObject({ completed_steps: [], completed_at: null })
    const badges = await db().as(device).sql('select badge_id from public.explorer_badges')
    expect(badges).toEqual([{ badge_id: `kit:${KIT}` }])
  })
})
