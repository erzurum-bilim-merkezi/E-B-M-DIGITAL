import { z } from 'zod'

import { activityTypeSchema, qrScanSourceSchema } from '@/entities/activity'
import { avatarSchema } from '@/entities/explorer'
import { AppError } from '@/shared/api/errors'
import { staffClient, unwrap } from '@/shared/api/supabase'

import { analyticsCsv } from './compute'
import type { AnalyticsReader, DayRange } from './port'

/*
 * Studio analytics on Supabase: every figure is computed in the database by the analytics_* RPCs
 * (supabase/migrations/…_analytics_rpc.sql), which a test suite compares with the mock's pure
 * computations (compute.ts) on the same rows. The browser never downloads raw events.
 */

const feedItemSchema = z.object({
  id: z.number(),
  at: z.string(),
  type: activityTypeSchema,
  explorer: z
    .object({ id: z.uuid(), nickname: z.string(), displayCode: z.string(), avatar: avatarSchema })
    .nullable(),
  kitTitle: z.string().nullable(),
  stepTitle: z.string().nullable(),
  code: z.string().nullable(),
  source: qrScanSourceSchema.nullable(),
  durationMs: z.number().nullable(),
  correct: z.boolean().nullable(),
  badgeName: z.string().nullable(),
})

const dashboardSchema = z.object({
  kpis: z.object({
    activeToday: z.number(),
    activeLast15m: z.number(),
    qrScansToday: z.number(),
    kitsCompletedThisWeek: z.number(),
    newExplorersToday: z.number(),
    monthlyActive: z.number(),
  }),
  trend: z.array(z.object({ day: z.string(), activeExplorers: z.number(), qrScans: z.number() })),
  topCards: z.array(
    z.object({
      kitId: z.string(),
      kitTitle: z.string(),
      stepId: z.string(),
      stepTitle: z.string(),
      code: z.string(),
      scans: z.number(),
    }),
  ),
  feed: z.array(feedItemSchema),
  perKit: z.record(
    z.string(),
    z.object({
      scans7d: z.number(),
      starts: z.number(),
      completions: z.number(),
      completionRate: z.number(),
    }),
  ),
  totals: z.object({ explorers: z.number(), events: z.number() }),
})

const kitStatsSchema = z.object({
  totals: z.object({
    opens: z.number(),
    starts: z.number(),
    completions: z.number(),
    scans: z.number(),
    avgKitDurationMs: z.number(),
  }),
  funnel: z.array(
    z.object({
      stepId: z.string(),
      title: z.string(),
      code: z.string(),
      opens: z.number(),
      completes: z.number(),
      avgDurationMs: z.number(),
    }),
  ),
  scansBySource: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      camera: z.number(),
      inApp: z.number(),
      manual: z.number(),
    }),
  ),
  quiz: z.array(
    z.object({ stepId: z.string(), title: z.string(), correct: z.number(), total: z.number() }),
  ),
  mostDropped: z.object({ stepId: z.string(), title: z.string(), dropRate: z.number() }).nullable(),
  heatmap: z.array(z.array(z.number())),
  trend: z.array(z.object({ day: z.string(), opens: z.number(), completes: z.number() })),
})

const explorerRowSchema = z.object({
  id: z.uuid(),
  nickname: z.string(),
  displayCode: z.string(),
  avatar: avatarSchema,
  createdAt: z.string(),
  lastSeenAt: z.string(),
  createdVia: z.enum(['self', 'center']),
  kitsStarted: z.number(),
  kitsCompleted: z.number(),
  badges: z.number(),
  qrScans: z.number(),
  devices: z.number(),
})

const explorerPageSchema = z.object({
  items: z.array(explorerRowSchema),
  total: z.number(),
  page: z.number(),
  pageCount: z.number(),
})

const explorerDetailSchema = z.object({
  row: explorerRowSchema,
  timeline: z.array(feedItemSchema),
  kits: z.array(
    z.object({
      kitId: z.string(),
      title: z.string(),
      completedSteps: z.number(),
      totalSteps: z.number(),
      completedAt: z.string().nullable(),
      startedAt: z.string(),
    }),
  ),
  badges: z.array(
    z.object({ badgeId: z.string(), name: z.string(), emoji: z.string(), earnedAt: z.string() }),
  ),
})

const overviewSchema = z.object({
  uniqueExplorers: z.number(),
  newExplorers: z.number(),
  returningExplorers: z.number(),
  avgVisitMs: z.number(),
  events: z.number(),
  daily: z.array(z.object({ day: z.string(), uniques: z.number(), events: z.number() })),
  kits: z.array(
    z.object({
      kitId: z.string(),
      title: z.string(),
      starts: z.number(),
      completions: z.number(),
      completionRate: z.number(),
      scans: z.number(),
    }),
  ),
  rangeWithinRetention: z.boolean(),
})

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Istanbul day keys ("2026-09-25"); anything else never reaches the database. */
function range({ from, to }: DayRange) {
  if (!DAY.test(from) || !DAY.test(to)) throw new AppError('validation', 'Tarih aralığı geçersiz.')
  return { p_from: from, p_to: to }
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return unwrap(await staffClient().rpc(name, args))
}

export function createSupabaseAnalyticsReader(): AnalyticsReader {
  return {
    async dashboard() {
      return dashboardSchema.parse(await rpc('analytics_dashboard'))
    },
    async kitStats(kitId, dayRange) {
      return kitStatsSchema.parse(
        await rpc('analytics_kit_stats', { p_kit: kitId, ...range(dayRange) }),
      )
    },
    async explorers(filter) {
      return explorerPageSchema.parse(
        await rpc('analytics_explorers', {
          p_query: filter.query,
          p_page: filter.page,
          p_page_size: filter.pageSize,
          p_kit: filter.kitId,
          p_completed: filter.completed,
        }),
      )
    },
    async explorerDetail(explorerId) {
      return explorerDetailSchema.parse(
        await rpc('analytics_explorer_detail', { p_explorer: explorerId }),
      )
    },
    async exportExplorer(explorerId) {
      return z
        .record(z.string(), z.unknown())
        .parse(await rpc('analytics_export_explorer', { p_explorer: explorerId }))
    },
    async deleteExplorer(explorerId) {
      await rpc('analytics_delete_explorer', { p_explorer: explorerId })
    },
    async overview(dayRange) {
      return overviewSchema.parse(await rpc('analytics_overview', range(dayRange)))
    },
    async exportCsv(dayRange) {
      // Same CSV builder as the mock: identical files from both backends.
      const items = z.array(feedItemSchema).parse(await rpc('analytics_csv_rows', range(dayRange)))
      return analyticsCsv(items)
    },
  }
}
