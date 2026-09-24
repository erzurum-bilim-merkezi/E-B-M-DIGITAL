import { z } from 'zod'

import { storedEventSchema, type ActivityEvent, type StoredEvent } from '@/entities/activity'
import {
  earnedBadgeSchema,
  explorerProgressSchema,
  explorerSchema,
  GLOBAL_BADGES,
  isGlobalBadgeId,
  type Explorer,
} from '@/entities/explorer'
import {
  kitVersionSchema,
  latestVersionOf,
  studioKitSchema,
  type KitDocument,
} from '@/entities/kit'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'
import { toCsv } from '@/shared/lib/download'
import { istanbulDayKey, istanbulHour, istanbulWeekday, lastDayKeys } from '@/shared/lib/format'

import type {
  AnalyticsReader,
  DashboardStats,
  DayRange,
  ExplorerRow,
  FeedItem,
  KitStats,
} from './port'

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

/** Raw event retention (days) — older ranges fall back to daily totals in production. */
export const RAW_RETENTION_DAYS = 60

type KitInfo = {
  title: string
  document: KitDocument
  steps: Map<string, { title: string; code: string; index: number }>
}

function kitInfos() {
  const versions = versionsTable.all()
  const infos = new Map<string, KitInfo>()
  for (const kit of kitsTable.all()) {
    const document = latestVersionOf(kit.id, versions)?.document ?? kit.draft
    const steps = new Map<string, { title: string; code: string; index: number }>()
    // Draft titles win for display; removed cards keep their published title.
    ;[...document.steps, ...kit.draft.steps].forEach((step, index) =>
      steps.set(step.id, { title: step.title, code: step.qrCode, index }),
    )
    infos.set(kit.id, { title: kit.draft.title || document.title, document, steps })
  }
  return infos
}

/** Statistics never include preview-device events. */
function liveEvents() {
  return eventsTable.filter((row) => !row.event.isPreview)
}

function badgeName(badgeId: string, infos: Map<string, KitInfo>) {
  if (isGlobalBadgeId(badgeId)) return GLOBAL_BADGES[badgeId].name
  const kitId = badgeId.startsWith('kit:') ? badgeId.slice(4) : ''
  return infos.get(kitId)?.document.badge.name ?? 'Kit rozeti'
}

function toFeedItem(
  row: StoredEvent,
  infos: Map<string, KitInfo>,
  explorers: Map<string, Explorer>,
  includeExplorer: boolean,
): FeedItem {
  const { event } = row
  const kit = event.kitId ? infos.get(event.kitId) : undefined
  const step = event.stepId ? kit?.steps.get(event.stepId) : undefined
  const explorer = explorers.get(event.explorerId)
  return {
    id: row.id,
    at: event.occurredAt,
    type: event.type,
    explorer:
      includeExplorer && explorer
        ? {
            id: explorer.id,
            nickname: explorer.nickname,
            displayCode: explorer.displayCode,
            avatar: explorer.avatar,
          }
        : null,
    kitTitle: kit?.title ?? null,
    stepTitle: step?.title ?? null,
    code: event.type === 'qr_scan' ? event.data.code : (step?.code ?? null),
    source: event.type === 'qr_scan' ? event.data.source : null,
    durationMs:
      event.type === 'card_complete' || event.type === 'kit_complete'
        ? event.data.durationMs
        : null,
    correct: event.type === 'quiz_answer' ? event.data.correct : null,
    badgeName: event.type === 'badge_earned' ? badgeName(event.data.badgeId, infos) : null,
  }
}

function inRange(event: ActivityEvent, range: DayRange) {
  const day = istanbulDayKey(event.occurredAt)
  return day >= range.from && day <= range.to
}

function daysOf(range: DayRange) {
  const days: string[] = []
  const end = Date.parse(`${range.to}T12:00:00+03:00`)
  for (
    let time = Date.parse(`${range.from}T12:00:00+03:00`);
    time <= end && days.length < 400;
    time += 86_400_000
  ) {
    days.push(istanbulDayKey(new Date(time)))
  }
  return days
}

function explorerRows(explorers: readonly Explorer[]): ExplorerRow[] {
  const progress = progressTable.all()
  const badges = badgesTable.all()
  const events = liveEvents()
  const devices = devicesTable.all()
  return explorers.map((explorer) => {
    const mine = progress.filter((row) => row.explorerId === explorer.id)
    return {
      id: explorer.id,
      nickname: explorer.nickname,
      displayCode: explorer.displayCode,
      avatar: explorer.avatar,
      createdAt: explorer.createdAt,
      lastSeenAt: explorer.lastSeenAt,
      createdVia: explorer.createdVia,
      kitsStarted: mine.length,
      kitsCompleted: mine.filter((row) => row.completedAt !== null).length,
      badges: badges.filter((row) => row.explorerId === explorer.id).length,
      qrScans: events.filter(
        (row) => row.event.explorerId === explorer.id && row.event.type === 'qr_scan',
      ).length,
      devices: devices.filter((row) => row.explorerId === explorer.id).length,
    }
  })
}

/**
 * Members created on preview devices only (all their events are preview) stay out of lists
 * and member counts.
 */
function previewOnlyExplorerIds(events: readonly StoredEvent[]) {
  const withLive = new Set<string>()
  const withPreview = new Set<string>()
  for (const { event } of events) {
    if (event.isPreview) withPreview.add(event.explorerId)
    else withLive.add(event.explorerId)
  }
  return new Set([...withPreview].filter((id) => !withLive.has(id)))
}

export function createMockAnalyticsReader(): AnalyticsReader {
  return {
    async dashboard() {
      await mockGate('analytics.dashboard')
      const caller = requireStaff()
      const infos = kitInfos()
      const events = liveEvents()
      const now = Date.now()
      const today = istanbulDayKey(new Date(now))
      const weekDays = new Set(lastDayKeys(7, new Date(now)))
      const explorers = new Map(explorersTable.all().map((explorer) => [explorer.id, explorer]))
      const previewOnly = previewOnlyExplorerIds(eventsTable.all())
      const members = [...explorers.values()].filter((explorer) => !previewOnly.has(explorer.id))

      const monthAgo = now - 30 * 86_400_000
      const monthly = new Set<string>()
      const activeToday = new Set<string>()
      const active15 = new Set<string>()
      let qrScansToday = 0
      let kitsCompletedThisWeek = 0
      const trendMap = new Map<string, { explorers: Set<string>; qr: number }>()
      const cardScans = new Map<string, number>()
      const perKit: DashboardStats['perKit'] = {}
      const starts = new Map<string, Set<string>>()
      const completions = new Map<string, Set<string>>()

      for (const { event } of events) {
        const time = Date.parse(event.occurredAt)
        const day = istanbulDayKey(event.occurredAt)
        if (time >= monthAgo) monthly.add(event.explorerId)
        if (day === today) activeToday.add(event.explorerId)
        if (now - time <= 15 * 60_000) active15.add(event.explorerId)
        const bucket = trendMap.get(day) ?? { explorers: new Set<string>(), qr: 0 }
        bucket.explorers.add(event.explorerId)
        if (event.type === 'qr_scan') {
          bucket.qr += 1
          if (day === today) qrScansToday++
          if (event.kitId) {
            const stats = (perKit[event.kitId] ??= {
              scans7d: 0,
              starts: 0,
              completions: 0,
              completionRate: 0,
            })
            if (weekDays.has(day)) stats.scans7d++
          }
          if (event.kitId && event.stepId)
            cardScans.set(
              `${event.kitId}|${event.stepId}`,
              (cardScans.get(`${event.kitId}|${event.stepId}`) ?? 0) + 1,
            )
        }
        trendMap.set(day, bucket)
        if (event.kitId && (event.type === 'kit_open' || event.type === 'card_open')) {
          const set = starts.get(event.kitId) ?? new Set<string>()
          set.add(event.explorerId)
          starts.set(event.kitId, set)
        }
        if (event.type === 'kit_complete' && event.kitId) {
          if (weekDays.has(day)) kitsCompletedThisWeek++
          const set = completions.get(event.kitId) ?? new Set<string>()
          set.add(event.explorerId)
          completions.set(event.kitId, set)
        }
      }
      for (const kitId of new Set([
        ...starts.keys(),
        ...completions.keys(),
        ...Object.keys(perKit),
      ])) {
        const stats = (perKit[kitId] ??= {
          scans7d: 0,
          starts: 0,
          completions: 0,
          completionRate: 0,
        })
        stats.starts = starts.get(kitId)?.size ?? 0
        stats.completions = completions.get(kitId)?.size ?? 0
        stats.completionRate = stats.starts > 0 ? stats.completions / stats.starts : 0
      }

      const includeExplorer = caller.role === 'admin'
      const feed = events
        .toSorted((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id - a.id)
        .slice(0, 25)
        .map((row) => toFeedItem(row, infos, explorers, includeExplorer))

      const topCards = [...cardScans.entries()]
        .map(([key, scans]) => {
          const [kitId = '', stepId = ''] = key.split('|')
          const kit = infos.get(kitId)
          const step = kit?.steps.get(stepId)
          return {
            kitId,
            kitTitle: kit?.title ?? 'Silinmiş kit',
            stepId,
            stepTitle: step?.title ?? 'Silinmiş kart',
            code: step?.code ?? '',
            scans,
          }
        })
        .toSorted((a, b) => b.scans - a.scans)
        .slice(0, 6)

      return {
        kpis: {
          activeToday: activeToday.size,
          activeLast15m: active15.size,
          qrScansToday,
          kitsCompletedThisWeek,
          newExplorersToday: members.filter(
            (explorer) => istanbulDayKey(explorer.createdAt) === today,
          ).length,
          // Built from live events only, so preview-only members never count.
          monthlyActive: monthly.size,
        },
        trend: lastDayKeys(30, new Date(now)).map((day) => ({
          day,
          activeExplorers: trendMap.get(day)?.explorers.size ?? 0,
          qrScans: trendMap.get(day)?.qr ?? 0,
        })),
        topCards,
        feed,
        perKit,
        totals: { explorers: members.length, events: events.length },
      }
    },

    async kitStats(kitId, range) {
      await mockGate('analytics.kitStats')
      requireStaff()
      const info = kitInfos().get(kitId)
      if (!info) throw new AppError('not_found', 'Kit bulunamadı.')
      const events = liveEvents()
        .map((row) => row.event)
        .filter((event) => event.kitId === kitId && inRange(event, range))
      const steps = info.document.steps
      const stepIds = new Set(steps.map((step) => step.id))
      const perStep = new Map(
        steps.map((step) => [
          step.id,
          {
            opens: new Set<string>(),
            completes: new Set<string>(),
            durations: [] as number[],
            correct: 0,
            total: 0,
            camera: 0,
            inApp: 0,
            manual: 0,
          },
        ]),
      )
      const kitScans = { camera: 0, inApp: 0, manual: 0 }
      const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
      const trend = new Map<string, { opens: number; completes: number }>()
      const kitOpens = new Set<string>()
      const kitCompletes = new Set<string>()
      const kitDurations: number[] = []
      let scans = 0

      for (const event of events) {
        const row = heatmap[istanbulWeekday(event.occurredAt)]
        if (row)
          row[istanbulHour(event.occurredAt)] = (row[istanbulHour(event.occurredAt)] ?? 0) + 1
        const day = istanbulDayKey(event.occurredAt)
        const bucket = trend.get(day) ?? { opens: 0, completes: 0 }
        const stats = event.stepId ? perStep.get(event.stepId) : undefined
        switch (event.type) {
          case 'kit_open':
            kitOpens.add(event.explorerId)
            break
          case 'card_open':
            bucket.opens++
            kitOpens.add(event.explorerId)
            stats?.opens.add(event.explorerId)
            break
          case 'card_complete':
            bucket.completes++
            stats?.completes.add(event.explorerId)
            stats?.durations.push(event.data.durationMs)
            break
          case 'quiz_answer':
            if (stats) {
              stats.total++
              if (event.data.correct) stats.correct++
            }
            break
          case 'kit_complete':
            kitCompletes.add(event.explorerId)
            kitDurations.push(event.data.durationMs)
            break
          case 'qr_scan': {
            scans++
            // Kit-code scans have no card; scans of cards no longer in the kit get no row.
            const target = event.stepId === null ? kitScans : stats
            if (!target) break
            if (event.data.source === 'camera-link') target.camera++
            else if (event.data.source === 'in-app') target.inApp++
            else target.manual++
            break
          }
          default:
            break
        }
        trend.set(day, bucket)
      }

      const funnel = steps.map((step) => {
        const stats = perStep.get(step.id)
        const durations = stats?.durations ?? []
        return {
          stepId: step.id,
          title: step.title,
          code: step.qrCode,
          opens: stats?.opens.size ?? 0,
          completes: stats?.completes.size ?? 0,
          avgDurationMs: durations.length
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0,
        }
      })
      const dropCandidates = funnel.filter((step) => step.opens >= 1)
      const mostDropped = dropCandidates.length
        ? (dropCandidates
            .map((step) => ({
              stepId: step.stepId,
              title: step.title,
              dropRate: step.opens > 0 ? 1 - step.completes / step.opens : 0,
            }))
            .toSorted((a, b) => b.dropRate - a.dropRate)[0] ?? null)
        : null

      const result: KitStats = {
        totals: {
          opens: kitOpens.size,
          starts: kitOpens.size,
          completions: kitCompletes.size,
          scans,
          avgKitDurationMs: kitDurations.length
            ? Math.round(kitDurations.reduce((a, b) => a + b, 0) / kitDurations.length)
            : 0,
        },
        funnel,
        scansBySource: [
          {
            code: info.document.qrPrefix,
            title: 'Kit kodu',
            camera: kitScans.camera,
            inApp: kitScans.inApp,
            manual: kitScans.manual,
          },
          ...steps.map((step) => {
            const stats = perStep.get(step.id)
            return {
              code: step.qrCode,
              title: step.title,
              camera: stats?.camera ?? 0,
              inApp: stats?.inApp ?? 0,
              manual: stats?.manual ?? 0,
            }
          }),
        ],
        quiz: steps
          .filter((step) => step.type === 'quiz')
          .map((step) => ({
            stepId: step.id,
            title: step.title,
            correct: perStep.get(step.id)?.correct ?? 0,
            total: perStep.get(step.id)?.total ?? 0,
          })),
        mostDropped:
          mostDropped && mostDropped.dropRate > 0 && stepIds.has(mostDropped.stepId)
            ? mostDropped
            : null,
        heatmap,
        trend: daysOf(range).map((day) => ({
          day,
          opens: trend.get(day)?.opens ?? 0,
          completes: trend.get(day)?.completes ?? 0,
        })),
      }
      return result
    },

    async explorers(filter) {
      await mockGate('analytics.explorers')
      requireStaff({ role: 'admin' })
      const needle = filter.query.trim().toLocaleLowerCase('tr')
      const previewOnly = previewOnlyExplorerIds(eventsTable.all())
      const progress = progressTable.all()
      const matching = explorersTable
        .filter((explorer) => !previewOnly.has(explorer.id))
        .filter(
          (explorer) =>
            !needle ||
            explorer.nickname.toLocaleLowerCase('tr').includes(needle) ||
            explorer.displayCode.toLowerCase().includes(needle.replace('#', '')),
        )
        .filter((explorer) => {
          if (filter.kitId === 'all' && filter.completed === 'all') return true
          const mine = progress.filter(
            (row) =>
              row.explorerId === explorer.id &&
              (filter.kitId === 'all' || row.kitId === filter.kitId),
          )
          if (filter.kitId !== 'all' && mine.length === 0) return false
          if (filter.completed === 'yes') return mine.some((row) => row.completedAt !== null)
          if (filter.completed === 'no') return mine.every((row) => row.completedAt === null)
          return true
        })
        .toSorted((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      const pageCount = Math.max(1, Math.ceil(matching.length / filter.pageSize))
      const page = Math.min(Math.max(1, filter.page), pageCount)
      return {
        items: explorerRows(matching.slice((page - 1) * filter.pageSize, page * filter.pageSize)),
        total: matching.length,
        page,
        pageCount,
      }
    },

    async explorerDetail(explorerId) {
      await mockGate('analytics.explorerDetail')
      requireStaff({ role: 'admin' })
      const explorer = explorersTable.find((row) => row.id === explorerId)
      if (!explorer) throw new AppError('not_found', 'Kâşif bulunamadı.')
      const infos = kitInfos()
      const explorers = new Map([[explorer.id, explorer]])
      const [row] = explorerRows([explorer])
      if (!row) throw new AppError('not_found')
      return {
        row,
        timeline: eventsTable
          .filter((stored) => stored.event.explorerId === explorerId)
          .toSorted((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id - a.id)
          .map((stored) => toFeedItem(stored, infos, explorers, true)),
        kits: progressTable
          .filter((progress) => progress.explorerId === explorerId)
          .map((progress) => {
            const info = infos.get(progress.kitId)
            return {
              kitId: progress.kitId,
              title: info?.title ?? 'Silinmiş kit',
              completedSteps: progress.completedSteps.length,
              totalSteps: info?.document.steps.length ?? progress.completedSteps.length,
              completedAt: progress.completedAt,
              startedAt: progress.startedAt,
            }
          }),
        badges: badgesTable
          .filter((badge) => badge.explorerId === explorerId)
          .map((badge) => {
            const global = isGlobalBadgeId(badge.badgeId) ? GLOBAL_BADGES[badge.badgeId] : null
            const kitDoc = badge.kitId ? infos.get(badge.kitId)?.document : undefined
            return {
              badgeId: badge.badgeId,
              name: global?.name ?? kitDoc?.badge.name ?? 'Kit rozeti',
              emoji: global?.emoji ?? kitDoc?.badge.emoji ?? '🏅',
              earnedAt: badge.earnedAt,
            }
          }),
      }
    },

    async exportExplorer(explorerId) {
      await mockGate('analytics.exportExplorer')
      const caller = requireStaff({ role: 'admin' })
      const explorer = explorersTable.find((row) => row.id === explorerId)
      if (!explorer) throw new AppError('not_found', 'Kâşif bulunamadı.')
      appendAudit({
        actorId: caller.userId,
        action: 'explorer.exported',
        entity: 'explorer',
        entityId: explorerId,
      })
      return {
        exportedAt: new Date().toISOString(),
        note: 'KVKK m.11 kapsamında kâşif üyeliğine ait tüm kayıtlar. Kâşif kodu sunucuda yalnızca özet olarak tutulur ve bu dosyada yer almaz.',
        explorer,
        devices: devicesTable
          .filter((row) => row.explorerId === explorerId)
          .map(({ linkedAt, lastSeenAt }) => ({ linkedAt, lastSeenAt })),
        progress: progressTable.filter((row) => row.explorerId === explorerId),
        badges: badgesTable.filter((row) => row.explorerId === explorerId),
        events: eventsTable
          .filter((row) => row.event.explorerId === explorerId)
          // oxlint-disable-next-line oxc/no-map-spread -- rows are the table's cached objects: copy, never mutate them in place
          .map((row) => ({ ...row.event, receivedAt: row.receivedAt })),
      }
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
      const infos = kitInfos()
      const events = liveEvents()
        .map((row) => row.event)
        .filter((event) => inRange(event, range))
      const days = daysOf(range)
      const uniques = new Set(events.map((event) => event.explorerId))
      const firstSeen = new Map(
        explorersTable.all().map((explorer) => [explorer.id, istanbulDayKey(explorer.createdAt)]),
      )
      const newOnes = [...uniques].filter((id) => {
        const day = firstSeen.get(id)
        return day !== undefined && day >= range.from && day <= range.to
      })
      // Visit = one explorer's events within a day; duration = last − first event.
      const visits = new Map<string, { first: number; last: number }>()
      for (const event of events) {
        const key = `${event.explorerId}|${istanbulDayKey(event.occurredAt)}`
        const time = Date.parse(event.occurredAt)
        const visit = visits.get(key) ?? { first: time, last: time }
        visit.first = Math.min(visit.first, time)
        visit.last = Math.max(visit.last, time)
        visits.set(key, visit)
      }
      const visitDurations = [...visits.values()]
        .map((visit) => visit.last - visit.first)
        .filter((ms) => ms > 0)
      const kits = [...infos.entries()].map(([kitId, info]) => {
        const mine = events.filter((event) => event.kitId === kitId)
        const starts = new Set(
          mine
            .filter((event) => event.type === 'kit_open' || event.type === 'card_open')
            .map((event) => event.explorerId),
        ).size
        const completions = new Set(
          mine.filter((event) => event.type === 'kit_complete').map((event) => event.explorerId),
        ).size
        return {
          kitId,
          title: info.title,
          starts,
          completions,
          completionRate: starts > 0 ? completions / starts : 0,
          scans: mine.filter((event) => event.type === 'qr_scan').length,
        }
      })
      const oldest = Date.parse(`${range.from}T00:00:00+03:00`)
      return {
        uniqueExplorers: uniques.size,
        newExplorers: newOnes.length,
        returningExplorers: uniques.size - newOnes.length,
        avgVisitMs: visitDurations.length
          ? Math.round(visitDurations.reduce((a, b) => a + b, 0) / visitDurations.length)
          : 0,
        events: events.length,
        daily: days.map((day) => {
          const dayEvents = events.filter((event) => istanbulDayKey(event.occurredAt) === day)
          return {
            day,
            uniques: new Set(dayEvents.map((event) => event.explorerId)).size,
            events: dayEvents.length,
          }
        }),
        kits: kits
          .filter((kit) => kit.starts > 0 || kit.scans > 0)
          .toSorted((a, b) => b.starts - a.starts),
        rangeWithinRetention: Date.now() - oldest <= RAW_RETENTION_DAYS * 86_400_000,
      }
    },

    async exportCsv(range) {
      await mockGate('analytics.exportCsv')
      const caller = requireStaff({ role: 'admin' })
      const infos = kitInfos()
      const explorers = new Map(explorersTable.all().map((explorer) => [explorer.id, explorer]))
      const rows = liveEvents()
        .filter((row) => inRange(row.event, range))
        .toSorted((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt))
        .map((row) => {
          const item = toFeedItem(row, infos, explorers, true)
          return [
            row.event.occurredAt,
            item.explorer ? `${item.explorer.nickname} #${item.explorer.displayCode}` : '',
            row.event.type,
            item.kitTitle ?? '',
            item.stepTitle ?? '',
            item.code ?? '',
            item.source ?? '',
            item.durationMs ?? '',
            item.correct === null ? '' : item.correct ? 'doğru' : 'yanlış',
          ]
        })
      appendAudit({
        actorId: caller.userId,
        action: 'analytics.csv_exported',
        entity: 'analytics',
        entityId: null,
        meta: range,
      })
      return toCsv(
        ['Zaman', 'Kâşif', 'Olay', 'Kit', 'Kart', 'Kod', 'QR kaynağı', 'Süre (ms)', 'Quiz'],
        rows,
      )
    },
  }
}
