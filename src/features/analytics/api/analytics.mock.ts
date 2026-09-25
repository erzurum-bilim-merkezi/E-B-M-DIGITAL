import { z } from 'zod'

import { storedEventSchema } from '@/entities/activity'
import { earnedBadgeSchema, explorerProgressSchema, explorerSchema } from '@/entities/explorer'
import { kitVersionSchema, studioKitSchema } from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'

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
} from './compute'
import type { AnalyticsReader } from './port'

const eventsTable = mockTable(MOCK_TABLES.explorerEvents, storedEventSchema)
const explorersTable = mockTable(MOCK_TABLES.explorers, explorerSchema)
const progressTable = mockTable(MOCK_TABLES.explorerProgress, explorerProgressSchema)
const badgesTable = mockTable(MOCK_TABLES.explorerBadges, earnedBadgeSchema)
const kitsTable = mockTable(MOCK_TABLES.kits, studioKitSchema)
const versionsTable = mockTable(MOCK_TABLES.kitVersions, kitVersionSchema)
const devicesTable = mockTable(
  MOCK_TABLES.explorerDevices,
  z.object({
    explorerId: z.uuid(),
    deviceUid: z.uuid(),
    linkedAt: z.string(),
    lastSeenAt: z.string(),
  }),
)
const secretsTable = mockTable(
  MOCK_TABLES.explorerSecrets,
  z.object({ explorerId: z.uuid(), restoreCodeHash: z.string() }),
)

/**
 * The mock tables as plain rows for the shared computations (./compute.ts), which the Supabase
 * RPCs mirror in SQL. Tables are cached after their first read, so this is cheap.
 */
function snapshot(): AnalyticsData {
  return {
    events: eventsTable.all(),
    explorers: explorersTable.all(),
    progress: progressTable.all(),
    badges: badgesTable.all(),
    kits: kitsTable.all(),
    versions: versionsTable.all(),
    devices: devicesTable.all(),
    now: Date.now(),
  }
}

export function createMockAnalyticsReader(): AnalyticsReader {
  return {
    async dashboard() {
      await mockGate('analytics.dashboard')
      const caller = requireStaff()
      return computeDashboard(snapshot(), { includeExplorer: caller.role === 'admin' })
    },

    async kitStats(kitId, range) {
      await mockGate('analytics.kitStats')
      requireStaff()
      const stats = computeKitStats(snapshot(), kitId, range)
      if (!stats) throw new AppError('not_found', 'Kit bulunamadı.')
      return stats
    },

    async explorers(filter) {
      await mockGate('analytics.explorers')
      requireStaff({ role: 'admin' })
      return computeExplorerPage(snapshot(), filter)
    },

    async explorerDetail(explorerId) {
      await mockGate('analytics.explorerDetail')
      requireStaff({ role: 'admin' })
      const detail = computeExplorerDetail(snapshot(), explorerId)
      if (!detail) throw new AppError('not_found', 'Kâşif bulunamadı.')
      return detail
    },

    async exportExplorer(explorerId) {
      await mockGate('analytics.exportExplorer')
      const caller = requireStaff({ role: 'admin' })
      const exported = computeExplorerExport(snapshot(), explorerId)
      if (!exported) throw new AppError('not_found', 'Kâşif bulunamadı.')
      appendAudit({
        actorId: caller.userId,
        action: 'explorer.exported',
        entity: 'explorer',
        entityId: explorerId,
      })
      return exported
    },

    async deleteExplorer(explorerId) {
      await mockGate('analytics.deleteExplorer')
      const caller = requireStaff({ role: 'admin' })
      if (!explorersTable.find((row) => row.id === explorerId))
        throw new AppError('not_found', 'Kâşif bulunamadı.')
      eventsTable.remove((row) => row.event.explorerId === explorerId)
      progressTable.remove((row) => row.explorerId === explorerId)
      badgesTable.remove((row) => row.explorerId === explorerId)
      devicesTable.remove((row) => row.explorerId === explorerId)
      secretsTable.remove((row) => row.explorerId === explorerId)
      explorersTable.remove((row) => row.id === explorerId)
      appendAudit({
        actorId: caller.userId,
        action: 'explorer.deleted',
        entity: 'explorer',
        entityId: explorerId,
      })
    },

    async overview(range) {
      await mockGate('analytics.overview')
      requireStaff()
      return computeOverview(snapshot(), range)
    },

    async exportCsv(range) {
      await mockGate('analytics.exportCsv')
      const caller = requireStaff({ role: 'admin' })
      const items = computeCsvItems(snapshot(), range)
      appendAudit({
        actorId: caller.userId,
        action: 'analytics.csv_exported',
        entity: 'analytics',
        entityId: null,
        meta: range,
      })
      return analyticsCsv(items)
    },
  }
}
