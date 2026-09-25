/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { z } from 'zod'

import { storedEventSchema } from '@/entities/activity'
import { earnedBadgeSchema, explorerProgressSchema, explorerSchema } from '@/entities/explorer'
import {
  analyticsCsv,
  computeCsvItems,
  computeDashboard,
  computeExplorerDetail,
  computeExplorerExport,
  computeExplorerPage,
  computeKitStats,
  computeOverview,
  type AnalyticsData,
} from '@/features/analytics/api/compute'
import type {
  DashboardStats,
  DayRange,
  ExplorerDetail,
  ExplorerFilter,
  ExplorerPage,
  FeedItem,
  KitStats,
  OverviewStats,
} from '@/features/analytics/api/port'
import { istanbulDayKey } from '@/shared/lib/format'

import { dbError, KS, setupTestDb, type Actor } from './harness.ts'

/*
 * The analytics RPCs must return exactly what the mock adapter computes for the same rows: every
 * test seeds a realistic centre (published, re-published and draft-only kits, members on shared
 * and preview devices, old and future events), reads the rows back and runs the mock's pure
 * computations (features/analytics/api/compute.ts) on them.
 */

const db = setupTestDb()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NBSP = String.fromCodePoint(0xa0)
const BOM = String.fromCodePoint(0xfeff)

type User = Extract<Actor, { kind: 'user' }>
type Card = { id: string; title: string; type: 'info' | 'quiz'; number: number }
type Draft = {
  id: string
  slug: string
  qrPrefix: string
  title: string
  version: number
  qrSequence: number
  badge: { name: string; emoji: string; color: string; description: string }
  steps: { id: string; slug: string; type: string; title: string; qrCode: string }[]
}
type Kit = { id: string; slug: string; qrPrefix: string; lockVersion: number; draft: Draft }

function draft(
  kit: Pick<Kit, 'id' | 'slug' | 'qrPrefix'>,
  title: string,
  badge: [name: string, emoji: string],
  cards: Card[],
): Draft {
  return {
    id: kit.id,
    slug: kit.slug,
    qrPrefix: kit.qrPrefix,
    title,
    version: 0,
    qrSequence: Math.max(0, ...cards.map((card) => card.number)),
    badge: { name: badge[0], emoji: badge[1], color: 'leaf', description: '' },
    steps: cards.map((card) => ({
      id: card.id,
      slug: card.id,
      type: card.type,
      title: card.title,
      qrCode: `${kit.qrPrefix}-${String(card.number).padStart(2, '0')}`,
    })),
  }
}

async function createKit(
  editor: User,
  slug: string,
  qrPrefix: string,
  content: (kit: Pick<Kit, 'id' | 'slug' | 'qrPrefix'>) => Draft,
) {
  const id = crypto.randomUUID()
  return db()
    .as(editor)
    .rpc<Kit>('kit_create', {
      p_id: id,
      p_slug: slug,
      p_qr_prefix: qrPrefix,
      p_draft: content({ id, slug, qrPrefix }),
    })
}

async function saveDraft(editor: User, kit: Kit, next: Draft) {
  return db()
    .as(editor)
    .rpc<Kit>('kit_save_draft', { p_kit: kit.id, p_draft: next, p_lock_version: kit.lockVersion })
}

async function reserveVersion(admin: User, kit: Kit) {
  return db().as(admin).rpc<{ version: number }>('publish_reserve_version', {
    p_kit: kit.id,
    p_lock_version: kit.lockVersion,
    p_document: kit.draft,
    p_notes: '',
    p_ai_review_confirmed: false,
  })
}

/** The publishing saga of the Studio (Storage writes are the app's part). */
async function publish(admin: User, kit: Kit) {
  const { version } = await reserveVersion(admin, kit)
  await db()
    .as(admin)
    .rpc('publish_finalize', { p_kit: kit.id, p_version: version, p_visibility: 'public' })
}

async function register(device: User, nickname: string, avatar: string) {
  return db()
    .as(device)
    .rpc<{ explorer: { id: string }; restoreCode: string }>('register_explorer', {
      p_nickname: nickname,
      p_avatar: avatar,
    })
}

type EventSpec = {
  explorer: string
  type: string
  data?: object
  kit: string | null
  step?: string | null
  at: string
  preview?: boolean
}

/** Sends events like the app's offline queue does. */
async function send(device: User, events: EventSpec[]) {
  const result = await db()
    .as(device)
    .rpc<{ accepted: number; rejected: number }>('record_events', {
      p_events: events.map((event) => ({
        clientEventId: crypto.randomUUID(),
        explorerId: event.explorer,
        kitId: event.kit,
        stepId: event.step ?? null,
        occurredAt: event.at,
        isPreview: event.preview ?? false,
        type: event.type,
        data: event.data ?? {},
      })),
    })
  expect(result).toMatchObject({ accepted: events.length, rejected: 0 })
}

/** Events the queue can no longer send (older than 7 days, draft-only or deleted kits). */
async function insertEvents(events: EventSpec[]) {
  for (const event of events) {
    await db().sql(
      `insert into public.explorer_events
         (client_event_id, explorer_id, kit_id, step_id, type, data, is_preview, occurred_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        event.explorer,
        event.kit,
        event.step ?? null,
        event.type,
        JSON.stringify(event.data ?? {}),
        event.preview ?? false,
        event.at,
      ],
    )
  }
}

const scan = (code: string, source: string) => ({ code, source })

type World = Awaited<ReturnType<typeof seedCentre>>
let world: World

async function seedCentre() {
  const [clock] = await db().sql<{ now: string }>('select private.iso_time(now()) as now')
  const now = Date.parse(clock?.now ?? '')
  const at = (offset: number) => new Date(now + offset).toISOString()
  const dayKey = (days: number) => istanbulDayKey(new Date(now + days * DAY))

  const admin = await db().createStaff({ role: 'admin' })
  const editor = await db().createStaff({ role: 'editor' })

  // Kit A: published twice, then edited again (card renamed, card swapped, title cleared) and a
  // third version reserved but never finalized. Its document is v2; the draft wins for titles.
  let farm = await createKit(editor, 'kucuk-ciftciler', 'KC', (kit) =>
    draft(
      kit,
      'Küçük Çiftçiler',
      ['Çiftçi', '🌱'],
      [
        { id: 's-1', title: 'Tohum', type: 'info', number: 1 },
        { id: 's-2', title: 'Kök mü gövde mi?', type: 'quiz', number: 2 },
        { id: 's-3', title: 'Filiz', type: 'info', number: 3 },
      ],
    ),
  )
  await publish(admin, farm)
  farm = await saveDraft(
    editor,
    farm,
    draft(
      farm,
      'Küçük Çiftçiler 2',
      ['Usta Çiftçi', '🧑‍🌾'],
      [
        { id: 's-1', title: 'Tohum ekelim', type: 'info', number: 1 },
        { id: 's-2', title: 'Kök mü gövde mi?', type: 'quiz', number: 2 },
        { id: 's-4', title: 'Hasat', type: 'quiz', number: 4 },
      ],
    ),
  )
  await publish(admin, farm)
  farm = await saveDraft(
    editor,
    farm,
    draft(
      farm,
      '',
      ['Çiftçi Ustası', '🚜'],
      [
        { id: 's-1', title: 'Tohum ekelim', type: 'info', number: 1 },
        { id: 's-2', title: 'Kök mü, gövde mi?', type: 'quiz', number: 2 },
        { id: 's-5', title: 'Sulama', type: 'info', number: 5 },
      ],
    ),
  )
  await reserveVersion(admin, farm)

  const space = await createKit(editor, 'uzay-kasifleri', 'UZ', (kit) =>
    draft(
      kit,
      'Uzay Kâşifleri',
      ['Astronot', '🚀'],
      [
        { id: 'u-1', title: 'Gezegenler', type: 'info', number: 1 },
        { id: 'u-2', title: 'Roket', type: 'quiz', number: 2 },
      ],
    ),
  )
  await publish(admin, space)
  // Never published: its document is the draft.
  const water = await createKit(editor, 'su-dongusu', 'SU', (kit) =>
    draft(
      kit,
      'Su Döngüsü',
      ['Damla', '💧'],
      [{ id: 'w-1', title: 'Bulut', type: 'info', number: 1 }],
    ),
  )
  const goneKit = crypto.randomUUID()

  // Members: two on a shared phone (one also restored on a tablet), one who never did anything
  // and one that only exists on a preview device.
  const phone = await db().createDevice()
  const tablet = await db().createDevice()
  const second = await db().createDevice()
  const idle = await db().createDevice()
  const fifth = await db().createDevice()
  const previewDevice = await db().createDevice()
  const ayse = await register(phone, 'Ayşe', 'teal')
  const ali = (await register(phone, 'Ali', 'leaf')).explorer.id
  const isik = (await register(second, 'Işık', 'sun')).explorer.id
  const deniz = (await register(idle, 'Deniz', 'coral')).explorer.id
  const can = (await register(fifth, 'Can', 'berry')).explorer.id
  const preview = (await register(previewDevice, 'Önizleme', 'indigo')).explorer.id
  await db().as(tablet).rpc('restore_explorer', { p_code: ayse.restoreCode })
  const ayseId = ayse.explorer.id

  const a = farm.id
  const b = space.id
  await send(phone, [
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('KC', 'camera-link'),
      kit: a,
      at: at(-6 * DAY),
    },
    { explorer: ayseId, type: 'kit_open', kit: a, at: at(-6 * DAY + 1000) },
    { explorer: ayseId, type: 'card_open', kit: a, step: 's-1', at: at(-6 * DAY + MINUTE) },
    {
      explorer: ayseId,
      type: 'card_complete',
      data: { durationMs: 42_000, attempts: 1 },
      kit: a,
      step: 's-1',
      at: at(-6 * DAY + 102_000),
    },
    { explorer: ayseId, type: 'card_open', kit: a, step: 's-2', at: at(-6 * DAY + 5 * MINUTE) },
    {
      explorer: ayseId,
      type: 'quiz_answer',
      data: { correct: false, optionId: 'a' },
      kit: a,
      step: 's-2',
      at: at(-6 * DAY + 5 * MINUTE + 10_000),
    },
    {
      explorer: ayseId,
      type: 'quiz_answer',
      data: { correct: true, optionId: 'b' },
      kit: a,
      step: 's-2',
      at: at(-6 * DAY + 5 * MINUTE + 20_000),
    },
    {
      explorer: ayseId,
      type: 'card_complete',
      data: { durationMs: 65_000, attempts: 2 },
      kit: a,
      step: 's-2',
      at: at(-6 * DAY + 6 * MINUTE),
    },
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('KC-04', 'in-app'),
      kit: a,
      step: 's-4',
      at: at(-2 * DAY),
    },
    { explorer: ayseId, type: 'card_open', kit: a, step: 's-4', at: at(-2 * DAY + MINUTE) },
    {
      explorer: ayseId,
      type: 'card_complete',
      data: { durationMs: 30_000, attempts: 1 },
      kit: a,
      step: 's-4',
      at: at(-2 * DAY + 2 * MINUTE),
    },
    {
      explorer: ayseId,
      type: 'kit_complete',
      data: { durationMs: 400_000 },
      kit: a,
      at: at(-2 * DAY + 3 * MINUTE),
    },
    {
      explorer: ayseId,
      type: 'card_complete',
      data: { durationMs: 38_000, attempts: 1 },
      kit: a,
      step: 's-1',
      at: at(-DAY + 5 * MINUTE),
    },
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('UZ-01', 'manual'),
      kit: b,
      step: 'u-1',
      at: at(-2 * HOUR),
    },
    { explorer: ayseId, type: 'card_open', kit: b, step: 'u-1', at: at(-2 * HOUR + MINUTE) },
    {
      explorer: ayseId,
      type: 'card_complete',
      data: { durationMs: 12_345, attempts: 1 },
      kit: b,
      step: 'u-1',
      at: at(-10 * MINUTE),
    },
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('UZ-02', 'camera-link'),
      kit: b,
      step: 'u-2',
      at: at(-9 * MINUTE),
    },
    // Ali on the same phone: drops out of the first card.
    {
      explorer: ali,
      type: 'qr_scan',
      data: scan('KC-01', 'camera-link'),
      kit: a,
      step: 's-1',
      at: at(-DAY),
    },
    { explorer: ali, type: 'card_open', kit: a, step: 's-1', at: at(-DAY + 30_000) },
    { explorer: ali, type: 'card_open', kit: a, step: 's-2', at: at(-3 * DAY) },
    {
      explorer: ali,
      type: 'quiz_answer',
      data: { correct: true, optionId: 'b' },
      kit: a,
      step: 's-2',
      at: at(-3 * DAY + 15_000),
    },
    {
      explorer: ali,
      type: 'card_complete',
      data: { durationMs: 10_001, attempts: 1 },
      kit: a,
      step: 's-2',
      at: at(-3 * DAY + 40_000),
    },
    { explorer: ali, type: 'kit_open', kit: b, at: at(-20 * MINUTE) },
    {
      explorer: ali,
      type: 'qr_scan',
      data: scan('UZ', 'in-app'),
      kit: b,
      at: at(-20 * MINUTE + 5000),
    },
  ])
  await send(second, [
    // A card that the current version no longer has.
    {
      explorer: isik,
      type: 'qr_scan',
      data: scan('KC-03', 'manual'),
      kit: a,
      step: 's-3',
      at: at(-5 * DAY),
    },
    { explorer: isik, type: 'card_open', kit: a, step: 's-3', at: at(-5 * DAY + 20_000) },
    {
      explorer: isik,
      type: 'kit_complete',
      data: { durationMs: 250_001 },
      kit: a,
      at: at(-4 * DAY),
    },
    {
      explorer: isik,
      type: 'qr_scan',
      data: scan('UZ-02', 'camera-link'),
      kit: b,
      step: 'u-2',
      at: at(-HOUR),
    },
    { explorer: isik, type: 'card_open', kit: b, step: 'u-2', at: at(-HOUR + 10_000) },
    {
      explorer: isik,
      type: 'quiz_answer',
      data: { correct: false, optionId: 'c' },
      kit: b,
      step: 'u-2',
      at: at(-HOUR + 20_000),
    },
    {
      explorer: isik,
      type: 'card_complete',
      data: { durationMs: 9999, attempts: 3 },
      kit: b,
      step: 'u-2',
      at: at(-HOUR + 30_000),
    },
    {
      explorer: isik,
      type: 'kit_complete',
      data: { durationMs: 50_000 },
      kit: b,
      at: at(-HOUR + 40_000),
    },
  ])
  await send(fifth, [
    { explorer: can, type: 'qr_scan', data: scan('KC', 'camera-link'), kit: a, at: at(-30_000) },
    { explorer: can, type: 'kit_open', kit: a, at: at(-MINUTE), preview: true },
    // A device clock slightly ahead (accepted up to 5 minutes).
    { explorer: can, type: 'card_open', kit: a, step: 's-1', at: at(3 * MINUTE) },
    // Opens without completing: both cards of kit B drop half of their members (a tie).
    { explorer: can, type: 'card_open', kit: b, step: 'u-1', at: at(-5 * MINUTE) },
  ])
  await send(phone, [
    { explorer: ali, type: 'card_open', kit: b, step: 'u-2', at: at(-16 * MINUTE) },
  ])
  await send(previewDevice, [
    {
      explorer: preview,
      type: 'qr_scan',
      data: scan('KC-01', 'in-app'),
      kit: a,
      step: 's-1',
      at: at(-40 * MINUTE),
      preview: true,
    },
    { explorer: preview, type: 'kit_open', kit: a, at: at(-39 * MINUTE), preview: true },
    {
      explorer: preview,
      type: 'card_open',
      kit: a,
      step: 's-1',
      at: at(-38 * MINUTE),
      preview: true,
    },
  ])

  // Istanbul day boundary: 00:30 in Istanbul is 21:30 UTC of the day before.
  const boundaryDay = dayKey(-3)
  const boundaryStart = Date.parse(`${boundaryDay}T00:00:00+03:00`)
  const afterMidnight = new Date(boundaryStart + 30 * MINUTE).toISOString()
  const beforeMidnight = new Date(boundaryStart - 1).toISOString()

  await insertEvents([
    // Older than the queue accepts.
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('KC-01', 'camera-link'),
      kit: a,
      step: 's-1',
      at: at(-10 * DAY),
    },
    { explorer: ayseId, type: 'card_open', kit: b, step: 'u-1', at: at(-29 * DAY - HOUR) },
    {
      explorer: ali,
      type: 'qr_scan',
      data: scan('UZ-01', 'in-app'),
      kit: b,
      step: 'u-1',
      at: at(-31 * DAY),
    },
    { explorer: ali, type: 'card_open', kit: a, step: 's-1', at: at(-45 * DAY) },
    // A card that exists only in the draft.
    {
      explorer: ayseId,
      type: 'qr_scan',
      data: scan('KC-05', 'camera-link'),
      kit: a,
      step: 's-5',
      at: at(-50 * MINUTE),
    },
    // A kit that no longer exists, with its badge.
    {
      explorer: isik,
      type: 'qr_scan',
      data: scan('SK-01', 'camera-link'),
      kit: goneKit,
      step: 'x-1',
      at: at(-3 * HOUR),
    },
    { explorer: isik, type: 'card_open', kit: goneKit, step: 'x-1', at: at(-3 * HOUR + MINUTE) },
    {
      explorer: isik,
      type: 'badge_earned',
      data: { badgeId: `kit:${goneKit}` },
      kit: goneKit,
      at: at(-3 * HOUR + 2 * MINUTE),
    },
    // The draft-only kit: live, preview and the day boundary.
    { explorer: ali, type: 'card_open', kit: water.id, step: 'w-1', at: at(-4 * HOUR) },
    {
      explorer: ali,
      type: 'qr_scan',
      data: scan('SU', 'in-app'),
      kit: water.id,
      at: at(-4 * HOUR + MINUTE),
    },
    {
      explorer: preview,
      type: 'card_open',
      kit: water.id,
      step: 'w-1',
      at: at(-35 * MINUTE),
      preview: true,
    },
    { explorer: can, type: 'card_open', kit: water.id, step: 'w-1', at: afterMidnight },
    { explorer: can, type: 'card_open', kit: water.id, step: 'w-1', at: beforeMidnight },
  ])
  await db().sql(
    `insert into public.explorer_kit_progress
       (explorer_id, kit_id, started_at, completed_steps, qr_scans)
     values ($1, $2, $3, '{x-1}', 1)`,
    [isik, goneKit, at(-3 * HOUR)],
  )
  await db().sql(
    `insert into public.explorer_badges (explorer_id, badge_id, kit_id, earned_at)
     values ($1, $2, $3, $4)`,
    [isik, `kit:${goneKit}`, goneKit, at(-3 * HOUR + 2 * MINUTE)],
  )

  // Registration and last-seen times. Ayşe and Ali were last seen at the same time: the one who
  // registered first (given the larger id, so an id order would differ) is listed first.
  const [registeredFirst, registeredLater] = [ayseId, ali].toSorted().toReversed()
  if (!registeredFirst || !registeredLater) throw new Error('two members')
  for (const [id, createdAt, lastSeenAt] of [
    [registeredFirst, at(-50 * DAY), at(-9 * MINUTE)],
    [registeredLater, at(-30 * DAY), at(-9 * MINUTE)],
    [isik, at(-5 * DAY - HOUR), at(-HOUR)],
  ] as const) {
    await db().sql('update public.explorers set created_at = $2, last_seen_at = $3 where id = $1', [
      id,
      createdAt,
      lastSeenAt,
    ])
  }

  return {
    now,
    at,
    dayKey,
    admin,
    editor,
    kits: { farm: a, space: b, water: water.id, gone: goneKit },
    members: { ayse: ayseId, ali, isik, deniz, can, preview },
    registrationOrder: [registeredFirst, registeredLater],
    devices: { phone, previewDevice },
    boundaryDay,
    afterMidnight,
  }
}

// --- reading the rows back for the mock computations ------------------------------------------

const documentSchema = z.object({
  title: z.string(),
  qrPrefix: z.string(),
  badge: z.object({ name: z.string(), emoji: z.string() }),
  steps: z.array(
    z.object({ id: z.string(), title: z.string(), qrCode: z.string(), type: z.string() }),
  ),
})
const kitSchema = z.object({ id: z.uuid(), draft: documentSchema })
const versionSchema = z.object({
  kitId: z.uuid(),
  version: z.int(),
  finalizedAt: z.string().nullable(),
  document: documentSchema,
})
const deviceSchema = z.object({
  explorerId: z.uuid(),
  linkedAt: z.string(),
  lastSeenAt: z.string(),
})

async function rows<T>(schema: z.ZodType<T>, query: string) {
  const result = await db().sql<{ row: unknown }>(query)
  return result.map(({ row }) => schema.parse(row))
}

/** Every table in the order the RPCs break ties in (the mock keeps table order). */
async function readData(): Promise<AnalyticsData> {
  const [clock] = await db().sql<{ now: string }>('select private.iso_time(now()) as now')
  return {
    now: Date.parse(clock?.now ?? ''),
    events: await rows(
      storedEventSchema,
      `select jsonb_build_object(
         'id', e.id, 'receivedAt', private.iso_time(e.received_at),
         'event', jsonb_build_object(
           'clientEventId', e.client_event_id, 'explorerId', e.explorer_id, 'kitId', e.kit_id,
           'stepId', e.step_id, 'occurredAt', private.iso_time(e.occurred_at),
           'isPreview', e.is_preview, 'type', e.type, 'data', e.data)) as row
       from public.explorer_events e order by e.id`,
    ),
    explorers: await rows(
      explorerSchema,
      `select jsonb_build_object(
         'id', x.id, 'nickname', x.nickname, 'avatar', x.avatar, 'displayCode', x.display_code,
         'settings', x.settings, 'createdVia', x.created_via,
         'createdAt', private.iso_time(x.created_at),
         'lastSeenAt', private.iso_time(x.last_seen_at)) as row
       from public.explorers x order by x.created_at, x.id`,
    ),
    progress: await rows(
      explorerProgressSchema,
      `select jsonb_build_object(
         'explorerId', p.explorer_id, 'kitId', p.kit_id,
         'startedAt', private.iso_time(p.started_at),
         'completedAt', private.iso_time(p.completed_at),
         'completedSteps', to_jsonb(p.completed_steps), 'qrScans', p.qr_scans,
         'totalDurationMs', p.total_duration_ms) as row
       from public.explorer_kit_progress p order by p.started_at, p.kit_id`,
    ),
    badges: await rows(
      earnedBadgeSchema,
      `select jsonb_build_object(
         'explorerId', b.explorer_id, 'badgeId', b.badge_id, 'kitId', b.kit_id,
         'earnedAt', private.iso_time(b.earned_at)) as row
       from public.explorer_badges b order by b.earned_at, b.badge_id`,
    ),
    kits: await rows(
      kitSchema,
      `select jsonb_build_object('id', k.id, 'draft', k.draft) as row
       from public.kits k order by k.created_at, k.id`,
    ),
    versions: await rows(
      versionSchema,
      `select jsonb_build_object(
         'kitId', v.kit_id, 'version', v.version,
         'finalizedAt', private.iso_time(v.finalized_at), 'document', v.document) as row
       from public.kit_versions v`,
    ),
    devices: await rows(
      deviceSchema,
      `select jsonb_build_object(
         'explorerId', d.explorer_id, 'linkedAt', private.iso_time(d.linked_at),
         'lastSeenAt', private.iso_time(d.last_seen_at)) as row
       from public.explorer_devices d order by d.linked_at, d.device_uid`,
    ),
  }
}

// --- RPC calls ---------------------------------------------------------------------------------

const call = <T>(actor: Actor, name: string, args: Record<string, unknown> = {}) =>
  db().as(actor).rpc<T>(name, args)

const kitStats = (actor: Actor, kitId: string, range: DayRange) =>
  call<KitStats>(actor, 'analytics_kit_stats', { p_kit: kitId, p_from: range.from, p_to: range.to })

const overview = (actor: Actor, range: DayRange) =>
  call<OverviewStats>(actor, 'analytics_overview', { p_from: range.from, p_to: range.to })

const explorerPage = (actor: Actor, filter: ExplorerFilter) =>
  call<ExplorerPage>(actor, 'analytics_explorers', {
    p_query: filter.query,
    p_page: filter.page,
    p_page_size: filter.pageSize,
    p_kit: filter.kitId,
    p_completed: filter.completed,
  })

const csvRows = (actor: Actor, range: DayRange) =>
  call<FeedItem[]>(actor, 'analytics_csv_rows', { p_from: range.from, p_to: range.to })

const thisWeek = (): DayRange => ({ from: world.dayKey(-6), to: world.dayKey(0) })

function namedRanges() {
  const { dayKey, boundaryDay } = world
  const today = dayKey(0)
  return {
    week: thisWeek(),
    retention: { from: dayKey(-59), to: today },
    // Starts before the raw-event retention window.
    beyondRetention: { from: dayKey(-60), to: today },
    today: { from: today, to: today },
    boundary: { from: boundaryDay, to: boundaryDay },
    oneDay: { from: dayKey(-4), to: dayKey(-4) },
    // Upside down: no days.
    upsideDown: { from: today, to: dayKey(-1) },
    // Longer than 400 days: the daily series stops at 400.
    long: { from: dayKey(-500), to: today },
  } satisfies Record<string, DayRange>
}

const ranges = () => Object.values(namedRanges())

beforeEach(async () => {
  world = await seedCentre()
})

describe('analytics_dashboard', () => {
  it('returns what the mock computes, naming members for admins only', async () => {
    const data = await readData()

    const forAdmin = await call<DashboardStats>(world.admin, 'analytics_dashboard')
    expect(forAdmin).toEqual(computeDashboard(data, { includeExplorer: true }))
    const forEditor = await call<DashboardStats>(world.editor, 'analytics_dashboard')
    expect(forEditor).toEqual(computeDashboard(data, { includeExplorer: false }))

    // The dataset exercises every part of the dashboard.
    expect(forAdmin.totals.explorers).toBe(5) // the preview-only member is no member
    expect(forAdmin.kpis).toMatchObject({ newExplorersToday: 2, activeLast15m: 2 })
    expect(forAdmin.topCards).toHaveLength(6)
    expect(forAdmin.topCards.map((card) => card.stepTitle)).toContain('Sulama')
    expect(forAdmin.perKit[world.kits.gone]).toMatchObject({ starts: 1, completions: 0 })
    expect(forAdmin.feed).toHaveLength(25)
    expect(forAdmin.feed.some((item) => item.explorer !== null)).toBe(true)
    expect(forEditor.feed.every((item) => item.explorer === null)).toBe(true)
  })
})

describe('analytics_kit_stats', () => {
  it('returns what the mock computes for every kit and range', async () => {
    const data = await readData()
    for (const kitId of [world.kits.farm, world.kits.space, world.kits.water]) {
      for (const range of ranges()) {
        expect(await kitStats(world.editor, kitId, range)).toEqual(
          computeKitStats(data, kitId, range),
        )
      }
    }

    // Up to tomorrow: Can's clock runs 3 minutes ahead.
    const upToTomorrow = { from: world.dayKey(-6), to: world.dayKey(1) }
    const week = await kitStats(world.editor, world.kits.farm, upToTomorrow)
    // The funnel follows the latest finalized version (v2), not the draft or the reserved v3.
    expect(week.funnel.map((step) => [step.stepId, step.title])).toEqual([
      ['s-1', 'Tohum ekelim'],
      ['s-2', 'Kök mü gövde mi?'],
      ['s-4', 'Hasat'],
    ])
    expect(week.totals.avgKitDurationMs).toBe(325_001) // (400 000 + 250 001) / 2, rounded up
    // Three members opened the first card, one completed it.
    expect(week.mostDropped).toEqual({ stepId: 's-1', title: 'Tohum ekelim', dropRate: 1 - 1 / 3 })
    // Equal drop rates: the earlier card wins.
    const space = await kitStats(world.editor, world.kits.space, thisWeek())
    expect(space.funnel.map((step) => [step.opens, step.completes])).toEqual([
      [2, 1],
      [2, 1],
    ])
    expect(space.mostDropped).toEqual({ stepId: 'u-1', title: 'Gezegenler', dropRate: 0.5 })
  })

  it('reports an unknown kit like the mock', async () => {
    const error = await dbError(
      kitStats(world.editor, world.kits.gone, { from: world.dayKey(0), to: world.dayKey(0) }),
    )
    expect(error.code).toBe(KS.not_found)
    expect(error.message).toBe('Kit bulunamadı.')
    expect(computeKitStats(await readData(), world.kits.gone, thisWeek())).toBeNull()
  })

  it('counts Istanbul days: 21:30 UTC is 00:30 of the next day', async () => {
    expect(world.afterMidnight).toMatch(/T21:30:00\.000Z$/)
    const day = world.boundaryDay
    const dayBefore = istanbulDayKey(new Date(Date.parse(`${day}T12:00:00+03:00`) - DAY))

    const stats = await kitStats(world.editor, world.kits.water, { from: day, to: day })
    expect(stats.trend).toEqual([{ day, opens: 1, completes: 0 }])
    expect(stats.heatmap.flat().reduce((sum, count) => sum + count, 0)).toBe(1)
    expect(stats.heatmap.some((hours) => hours[0] === 1)).toBe(true)

    const before = await kitStats(world.editor, world.kits.water, {
      from: dayBefore,
      to: dayBefore,
    })
    expect(before.trend).toEqual([{ day: dayBefore, opens: 1, completes: 0 }])
    expect(before.heatmap.some((hours) => hours[23] === 1)).toBe(true)

    const both = await overview(world.editor, { from: dayBefore, to: day })
    expect(both.daily).toEqual(
      computeOverview(await readData(), { from: dayBefore, to: day }).daily,
    )
  })
})

describe('analytics_explorers', () => {
  it('lists, searches, filters and pages like the mock', async () => {
    const data = await readData()
    const { ayse, ali, isik } = world.members
    const codeOfIsik = data.explorers.find((row) => row.id === isik)?.displayCode ?? ''
    const base: ExplorerFilter = {
      query: '',
      page: 1,
      pageSize: 20,
      kitId: 'all',
      completed: 'all',
    }
    const filters: ExplorerFilter[] = [
      base,
      { ...base, query: 'ay' },
      { ...base, query: 'AYŞE' },
      { ...base, query: 'IŞIK' },
      { ...base, query: 'işık' },
      { ...base, query: `${NBSP} ali \t` },
      { ...base, query: `#${codeOfIsik}` },
      { ...base, query: codeOfIsik.toLowerCase() },
      { ...base, query: '#' },
      { ...base, query: 'önizleme' },
      { ...base, kitId: world.kits.farm },
      { ...base, kitId: world.kits.farm, completed: 'yes' },
      { ...base, kitId: world.kits.farm, completed: 'no' },
      { ...base, completed: 'yes' },
      { ...base, completed: 'no' },
      { ...base, kitId: world.kits.gone, completed: 'no' },
      { ...base, kitId: 'bilinmeyen' },
      { ...base, pageSize: 2 },
      { ...base, pageSize: 2, page: 2 },
      { ...base, pageSize: 2, page: 3 },
      { ...base, pageSize: 2, page: 99 },
      { ...base, page: 0 },
    ]
    for (const filter of filters) {
      expect(await explorerPage(world.admin, filter)).toEqual(computeExplorerPage(data, filter))
    }

    // Spot checks of the rules behind those pages.
    const all = await explorerPage(world.admin, base)
    expect(all.total).toBe(5)
    expect(all.items.map((row) => row.id)).not.toContain(world.members.preview)
    expect((await explorerPage(world.admin, { ...base, query: 'IŞIK' })).items).toEqual([
      expect.objectContaining({ id: isik, qrScans: 3, badges: 4, devices: 1 }),
    ])
    expect((await explorerPage(world.admin, { ...base, query: 'işık' })).total).toBe(0)
    expect(all.items.find((row) => row.id === ayse)).toMatchObject({ devices: 2, kitsStarted: 2 })
    const tie = all.items.filter((row) => row.id === ayse || row.id === ali).map((row) => row.id)
    expect(tie).toEqual(world.registrationOrder) // same last-seen time: registered first first
    expect(await explorerPage(world.admin, { ...base, pageSize: 2, page: 99 })).toMatchObject({
      page: 3,
      pageCount: 3,
    })
  })

  it('refuses page sizes the Studio never asks for', async () => {
    for (const size of [0, 101]) {
      const error = await dbError(
        explorerPage(world.admin, {
          query: '',
          page: 1,
          pageSize: size,
          kitId: 'all',
          completed: 'all',
        }),
      )
      expect(error.code).toBe(KS.validation)
    }
  })
})

describe('explorer detail, export and deletion', () => {
  it('returns every member like the mock, previews included in the timeline', async () => {
    const data = await readData()
    for (const id of Object.values(world.members)) {
      const detail = await call<ExplorerDetail>(world.admin, 'analytics_explorer_detail', {
        p_explorer: id,
      })
      expect(detail).toEqual(computeExplorerDetail(data, id))
    }

    const isik = await call<ExplorerDetail>(world.admin, 'analytics_explorer_detail', {
      p_explorer: world.members.isik,
    })
    expect(isik.badges.map((badge) => badge.name).toSorted()).toEqual([
      'Astronot',
      'Kit rozeti',
      'Usta Çiftçi', // the badge of the live version, not of the draft
      'İlk QR’ım',
    ])
    expect(isik.kits.find((kit) => kit.kitId === world.kits.gone)).toMatchObject({
      title: 'Silinmiş kit',
      totalSteps: 1,
    })
    const can = await call<ExplorerDetail>(world.admin, 'analytics_explorer_detail', {
      p_explorer: world.members.can,
    })
    expect(can.row.qrScans).toBe(1)
    expect(can.timeline.map((item) => item.type)).toContain('kit_open') // the preview event

    const missing = dbError(
      call(world.admin, 'analytics_explorer_detail', { p_explorer: crypto.randomUUID() }),
    )
    expect(await missing).toMatchObject({ code: KS.not_found, message: 'Kâşif bulunamadı.' })
  })

  it('exports everything stored about a member (KVKK m.11) and audits it', async () => {
    const data = await readData()
    for (const id of Object.values(world.members)) {
      const exported = await call<Record<string, unknown>>(
        world.admin,
        'analytics_export_explorer',
        { p_explorer: id },
      )
      expect(exported).toEqual(computeExplorerExport(data, id))
      expect(JSON.stringify(exported)).not.toMatch(/restore|hash/i)
    }

    const audit = await db().sql<{ entity_id: string; actor_id: string }>(
      `select entity_id, actor_id from public.audit_log where action = 'explorer.exported'`,
    )
    expect(audit.map((row) => row.entity_id).toSorted()).toEqual(
      Object.values(world.members).toSorted(),
    )
    expect(new Set(audit.map((row) => row.actor_id))).toEqual(new Set([world.admin.id]))
    const missing = dbError(
      call(world.admin, 'analytics_export_explorer', { p_explorer: crypto.randomUUID() }),
    )
    expect((await missing).code).toBe(KS.not_found)
  })

  it('deletes a member with everything it did and audits it', async () => {
    const { ayse } = world.members
    await call(world.admin, 'analytics_delete_explorer', { p_explorer: ayse })

    const [left] = await db().sql<Record<string, number>>(
      `select
         (select count(*)::int from public.explorers where id = $1) as explorers,
         (select count(*)::int from public.explorer_secrets where explorer_id = $1) as secrets,
         (select count(*)::int from public.explorer_devices where explorer_id = $1) as devices,
         (select count(*)::int from public.explorer_events where explorer_id = $1) as events,
         (select count(*)::int from public.explorer_kit_progress where explorer_id = $1) as progress,
         (select count(*)::int from public.explorer_badges where explorer_id = $1) as badges`,
      [ayse],
    )
    expect(left).toEqual({
      explorers: 0,
      secrets: 0,
      devices: 0,
      events: 0,
      progress: 0,
      badges: 0,
    })
    const audit = await db().sql(
      `select actor_id, entity, entity_id from public.audit_log where action = 'explorer.deleted'`,
    )
    expect(audit).toEqual([{ actor_id: world.admin.id, entity: 'explorer', entity_id: ayse }])

    // The numbers follow at once.
    expect(await call(world.admin, 'analytics_dashboard')).toEqual(
      computeDashboard(await readData(), { includeExplorer: true }),
    )
    const again = dbError(call(world.admin, 'analytics_delete_explorer', { p_explorer: ayse }))
    expect(await again).toMatchObject({ code: KS.not_found, message: 'Kâşif bulunamadı.' })
  })
})

describe('analytics_overview and analytics_csv_rows', () => {
  it('returns the centre overview the mock computes for every range', async () => {
    const data = await readData()
    for (const range of ranges()) {
      expect(await overview(world.editor, range)).toEqual(computeOverview(data, range))
    }
    const { week, retention, beyondRetention, long } = namedRanges()
    const stats = await overview(world.editor, week)
    expect(stats).toMatchObject({ uniqueExplorers: 4, newExplorers: 2, returningExplorers: 2 })
    expect(stats.kits.map((kit) => kit.kitId)).toEqual(
      expect.arrayContaining([world.kits.farm, world.kits.space, world.kits.water]),
    )
    expect((await overview(world.editor, retention)).rangeWithinRetention).toBe(true)
    expect((await overview(world.editor, beyondRetention)).rangeWithinRetention).toBe(false)
    expect((await overview(world.editor, long)).daily).toHaveLength(400)
  })

  it('returns the CSV rows of the mock, so both adapters build the same file, and audits it', async () => {
    const data = await readData()
    for (const range of ranges()) {
      const items = await csvRows(world.admin, range)
      expect(items).toEqual(computeCsvItems(data, range))
      expect(analyticsCsv(items)).toBe(analyticsCsv(computeCsvItems(data, range)))
    }

    const csv = analyticsCsv(await csvRows(world.admin, thisWeek()))
    expect(csv.split('\r\n')[0]).toBe(
      `${BOM}Zaman;Kâşif;Olay;Kit;Kart;Kod;QR kaynağı;Süre (ms);Quiz`,
    )
    expect(csv).toContain('doğru')
    expect(csv).not.toContain('Önizleme')

    const audit = await db().sql<{ meta: DayRange; entity_id: string | null }>(
      `select meta, entity_id from public.audit_log where action = 'analytics.csv_exported'
       order by at`,
    )
    expect(audit).toHaveLength(ranges().length + 1)
    expect(audit[0]).toEqual({ meta: thisWeek(), entity_id: null })
  })
})

type Call = [name: string, args: Record<string, unknown>]

/** Aggregates: every active staff member. */
function aggregateCalls(): Call[] {
  const today = world.dayKey(0)
  return [
    ['analytics_dashboard', {}],
    ['analytics_kit_stats', { p_kit: world.kits.farm, p_from: today, p_to: today }],
    ['analytics_overview', { p_from: today, p_to: today }],
  ]
}

/** Member-level data (KVKK): admins after TOTP only. */
function adminCalls(): Call[] {
  const today = world.dayKey(0)
  const member = world.members.isik
  return [
    [
      'analytics_explorers',
      { p_query: '', p_page: 1, p_page_size: 20, p_kit: 'all', p_completed: 'all' },
    ],
    ['analytics_explorer_detail', { p_explorer: member }],
    ['analytics_export_explorer', { p_explorer: member }],
    ['analytics_csv_rows', { p_from: today, p_to: today }],
    ['analytics_delete_explorer', { p_explorer: member }],
  ]
}

describe('permissions', () => {
  it('gives editors aggregates only', async () => {
    for (const [name, args] of aggregateCalls()) {
      await expect(call(world.editor, name, args)).resolves.toBeTruthy()
    }
    for (const [name, args] of adminCalls()) {
      expect((await dbError(call(world.editor, name, args))).code).toBe(KS.forbidden)
    }
    expect(
      await db().sql('select id from public.explorers where id = $1', [world.members.isik]),
    ).toHaveLength(1)
    const audited = await db().sql(
      `select action from public.audit_log where entity in ('explorer', 'analytics')`,
    )
    expect(audited).toEqual([])
  })

  it('refuses admins before TOTP, Kâşif devices and visitors', async () => {
    const adminWithoutTotp = await db().createStaff({ role: 'admin', aal: 'aal1' })
    for (const [name, args] of [...aggregateCalls(), ...adminCalls()]) {
      expect((await dbError(call(adminWithoutTotp, name, args))).code).toBe(KS.forbidden)
      expect((await dbError(call(world.devices.phone, name, args))).code).toBe(KS.unauthorized)
      // No EXECUTE grant for anon at all.
      expect((await dbError(call({ kind: 'anon' }, name, args))).code).toBe('42501')
    }
  })
})
