import { isAppError } from '@/shared/api/errors'
import { resetSupabase, rpc, rpcError, signedInStaff } from '@/test/supabase'

import { createSupabaseAnalyticsReader } from './analytics.supabase'
import { analyticsCsv } from './compute'
import type { FeedItem } from './port'

const reader = createSupabaseAnalyticsReader()

const FEED_ITEM: FeedItem = {
  id: 7,
  at: '2026-09-25T09:30:00.000Z',
  type: 'qr_scan',
  explorer: null,
  kitTitle: 'Küçük Çiftçiler',
  stepTitle: null,
  code: 'KC',
  source: 'in-app',
  durationMs: null,
  correct: null,
  badgeName: null,
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

beforeEach(() => signedInStaff())
afterEach(resetSupabase)

describe('Supabase analytics reader', () => {
  it('reads the dashboard computed in the database', async () => {
    rpc('analytics_dashboard', () => ({
      kpis: {
        activeToday: 3,
        activeLast15m: 1,
        qrScansToday: 5,
        kitsCompletedThisWeek: 2,
        newExplorersToday: 1,
        monthlyActive: 9,
      },
      trend: [{ day: '2026-09-25', activeExplorers: 3, qrScans: 5 }],
      topCards: [],
      feed: [FEED_ITEM],
      perKit: { kit: { scans7d: 5, starts: 2, completions: 1, completionRate: 0.5 } },
      totals: { explorers: 9, events: 40 },
    }))
    const stats = await reader.dashboard()
    expect(stats.kpis.monthlyActive).toBe(9)
    expect(stats.feed).toEqual([FEED_ITEM])
  })

  it('pages and filters members on the server (admins only)', async () => {
    const calls = rpc('analytics_explorers', () => ({ items: [], total: 0, page: 1, pageCount: 1 }))
    await reader.explorers({ query: 'ayşe', page: 2, pageSize: 20, kitId: 'all', completed: 'yes' })
    expect(calls).toEqual([
      { p_query: 'ayşe', p_page: 2, p_page_size: 20, p_kit: 'all', p_completed: 'yes' },
    ])

    rpcError('analytics_explorers', 'KS403', 'Bu işlem için yönetici yetkisi gerekiyor.')
    const error = await failure(
      reader.explorers({ query: '', page: 1, pageSize: 20, kitId: 'all', completed: 'all' }),
    )
    expect(isAppError(error, 'forbidden')).toBe(true)
  })

  it('refuses a malformed day range before any request', async () => {
    const error = await failure(reader.overview({ from: '25.09.2026', to: '2026-09-30' }))
    expect(isAppError(error, 'validation')).toBe(true)
  })

  it('builds the CSV with the same code as the mock backend', async () => {
    const calls = rpc('analytics_csv_rows', () => [FEED_ITEM])
    const csv = await reader.exportCsv({ from: '2026-09-01', to: '2026-09-30' })
    expect(calls).toEqual([{ p_from: '2026-09-01', p_to: '2026-09-30' }])
    expect(csv).toBe(analyticsCsv([FEED_ITEM]))
  })
})
