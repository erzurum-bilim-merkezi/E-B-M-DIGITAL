import { storedEventSchema, type ActivityEvent } from '@/entities/activity'
import { DEFAULT_EXPLORER_SETTINGS, explorerSchema, type Explorer } from '@/entities/explorer'
import { studioKitSchema, type StudioKit } from '@/entities/kit'
import { mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'
import { istanbulDayKey } from '@/shared/lib/format'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { analyticsReader } from './index'

/*
 * Staff numbers must describe real visitors: preview-device activity (staff trying a kit) and
 * scans of cards that are no longer in a kit stay out of them.
 */

const explorersTable = mockTable(MOCK_TABLES.explorers, explorerSchema)
const eventsTable = mockTable(MOCK_TABLES.explorerEvents, storedEventSchema)
const kitsTable = mockTable(MOCK_TABLES.kits, studioKitSchema)

const DAY_MS = 86_400_000

function addExplorer(nickname: string, createdAt: Date): Explorer {
  return explorersTable.insert({
    id: crypto.randomUUID(),
    nickname,
    avatar: 'teal',
    displayCode: 'A7F2',
    settings: DEFAULT_EXPLORER_SETTINGS,
    createdVia: 'self',
    createdAt: createdAt.toISOString(),
    lastSeenAt: new Date().toISOString(),
  })
}

/** An event without the fields the helper fills in (distributes over the event union). */
type EventInput = ActivityEvent extends infer Event
  ? Event extends ActivityEvent
    ? Omit<Event, 'clientEventId' | 'occurredAt' | 'isPreview'>
    : never
  : never

function addEvent(event: EventInput, { preview = false } = {}) {
  const occurredAt = new Date().toISOString()
  eventsTable.insert({
    id: eventsTable.count() + 1,
    receivedAt: occurredAt,
    event: { ...event, clientEventId: crypto.randomUUID(), occurredAt, isPreview: preview },
  })
}

function scan(
  explorerId: string,
  kitId: string,
  stepId: string | null,
  source: 'camera-link' | 'in-app' | 'manual',
): EventInput {
  return { type: 'qr_scan', explorerId, kitId, stepId, data: { code: 'KC', source } }
}

function kitBySlug(slug: string): StudioKit {
  const kit = kitsTable.find((row) => row.slug === slug)
  if (!kit) throw new Error(`The seed has no ${slug} kit`)
  return kit
}

/** A regular member, a newcomer from today and a member who only exists on a preview device. */
function seedMembers() {
  const kit = kitBySlug('kucuk-ciftciler')
  const regular = addExplorer('Ada', new Date(Date.now() - 2 * DAY_MS))
  const newcomer = addExplorer('Can', new Date())
  const previewOnly = addExplorer('Önizleme', new Date())
  addEvent(scan(regular.id, kit.id, null, 'camera-link'))
  // The same member also tried the kit on a preview device once.
  addEvent(scan(regular.id, kit.id, null, 'in-app'), { preview: true })
  addEvent({ type: 'kit_open', explorerId: newcomer.id, kitId: kit.id, stepId: null, data: {} })
  addEvent(scan(previewOnly.id, kit.id, null, 'in-app'), { preview: true })
  addEvent(
    { type: 'kit_open', explorerId: previewOnly.id, kitId: kit.id, stepId: null, data: {} },
    { preview: true },
  )
  return { regular, newcomer, previewOnly }
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('admin')
})

describe('preview-only members', () => {
  it('stay out of the dashboard member numbers', async () => {
    seedMembers()

    const { kpis, totals } = await analyticsReader.dashboard()

    expect(kpis.newExplorersToday).toBe(1)
    expect(kpis.monthlyActive).toBe(2)
    expect(totals.explorers).toBe(2)
  })

  it('stay out of the explorer list, whose scan counts ignore preview events', async () => {
    const { regular, newcomer } = seedMembers()

    const page = await analyticsReader.explorers({
      query: '',
      page: 1,
      pageSize: 20,
      kitId: 'all',
      completed: 'all',
    })

    expect(page.total).toBe(2)
    expect(page.items.map((row) => [row.id, row.qrScans])).toEqual(
      expect.arrayContaining([
        [regular.id, 1],
        [newcomer.id, 0],
      ]),
    )
    expect((await analyticsReader.explorerDetail(regular.id)).row.qrScans).toBe(1)
  })
})

describe('kit statistics', () => {
  it('counts only kit-code scans on the kit row and ignores scans of removed cards', async () => {
    const kit = kitBySlug('kucuk-ciftciler')
    const [card] = kit.draft.steps
    if (!card) throw new Error('The sample kit has cards')
    const explorer = addExplorer('Ece', new Date())
    addEvent(scan(explorer.id, kit.id, null, 'camera-link'))
    addEvent(scan(explorer.id, kit.id, card.id, 'in-app'))
    addEvent(scan(explorer.id, kit.id, 's-silinmis-kart', 'manual'))
    const today = istanbulDayKey(new Date())

    const stats = await analyticsReader.kitStats(kit.id, { from: today, to: today })

    expect(stats.scansBySource[0]).toEqual({
      code: 'KC',
      title: 'Kit kodu',
      camera: 1,
      inApp: 0,
      manual: 0,
    })
    expect(stats.scansBySource.find((row) => row.code === card.qrCode)).toMatchObject({
      camera: 0,
      inApp: 1,
      manual: 0,
    })
    expect(stats.scansBySource.every((row) => row.manual === 0)).toBe(true)
    expect(stats.totals.scans).toBe(3)
  })
})
