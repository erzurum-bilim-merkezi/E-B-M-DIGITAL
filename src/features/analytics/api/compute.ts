import type { StoredEvent } from '@/entities/activity'
import {
  GLOBAL_BADGES,
  isGlobalBadgeId,
  type EarnedBadge,
  type Explorer,
  type ExplorerProgress,
} from '@/entities/explorer'
import { latestVersionOf } from '@/entities/kit'
import { toCsv } from '@/shared/lib/csv'
import { istanbulDayKey, istanbulHour, istanbulWeekday, lastDayKeys } from '@/shared/lib/format'

import type {
  DashboardStats,
  DayRange,
  ExplorerDetail,
  ExplorerFilter,
  ExplorerPage,
  ExplorerRow,
  FeedItem,
  KitStats,
  OverviewStats,
} from './port'

/*
 * Studio analytics as pure functions over plain rows (ADR 0012). The mock adapter runs them on
 * its tables; the Supabase RPCs (supabase/migrations/*_analytics_rpc.sql) compute the same
 * numbers in SQL, and the database tests compare both on the same rows. Rules:
 *   - statistics never include preview-device events
 *   - members whose events all come from preview devices stay out of lists and member counts
 *   - days are Europe/Istanbul days
 *   - rows are passed in table order; equal timestamps keep that order
 */

/** Raw event retention (days) — older ranges fall back to daily totals in production. */
export const RAW_RETENTION_DAYS = 60

const DAY_MS = 86_400_000

/** The parts of a kit document the statistics read (KitDocument satisfies it). */
export type AnalyticsKitDocument = {
  title: string
  qrPrefix: string
  badge: { name: string; emoji: string }
  steps: readonly { id: string; title: string; qrCode: string; type: string }[]
}

export type AnalyticsKit = { id: string; draft: AnalyticsKitDocument }

export type AnalyticsKitVersion = {
  kitId: string
  version: number
  finalizedAt: string | null
  document: AnalyticsKitDocument
}

export type AnalyticsDevice = { explorerId: string; linkedAt: string; lastSeenAt: string }

export type AnalyticsData = {
  events: readonly StoredEvent[]
  explorers: readonly Explorer[]
  progress: readonly ExplorerProgress[]
  badges: readonly EarnedBadge[]
  kits: readonly AnalyticsKit[]
  versions: readonly AnalyticsKitVersion[]
  devices: readonly AnalyticsDevice[]
  /** The moment the numbers describe (epoch milliseconds). */
  now: number
}

type KitRows = Pick<AnalyticsData, 'kits' | 'versions'>
type MemberRows = Pick<AnalyticsData, 'events' | 'progress' | 'badges' | 'devices'>

export const EXPLORER_EXPORT_NOTE =
  'KVKK m.11 kapsamında kâşif üyeliğine ait tüm kayıtlar. Kâşif kodu sunucuda yalnızca özet olarak tutulur ve bu dosyada yer almaz.'

export const ANALYTICS_CSV_HEADERS = [
  'Zaman',
  'Kâşif',
  'Olay',
  'Kit',
  'Kart',
  'Kod',
  'QR kaynağı',
  'Süre (ms)',
  'Quiz',
] as const

type StepInfo = { title: string; code: string }

type KitInfo = {
  title: string
  document: AnalyticsKitDocument
  steps: Map<string, StepInfo>
}

/** Display data per kit: the latest published version is the kit, draft titles win. */
function kitInfos({ kits, versions }: KitRows) {
  const infos = new Map<string, KitInfo>()
  for (const kit of kits) {
    const document = latestVersionOf(kit.id, versions)?.document ?? kit.draft
    const steps = new Map<string, StepInfo>()
    // Draft titles win for display; removed cards keep their published title.
    for (const step of [...document.steps, ...kit.draft.steps]) {
      steps.set(step.id, { title: step.title, code: step.qrCode })
    }
    infos.set(kit.id, { title: kit.draft.title || document.title, document, steps })
  }
  return infos
}

/** Statistics never include preview-device events. */
function liveEvents(events: readonly StoredEvent[]) {
  return events.filter((row) => !row.event.isPreview)
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

function inRange(occurredAt: string, range: DayRange) {
  const day = istanbulDayKey(occurredAt)
  return day >= range.from && day <= range.to
}

/** Istanbul day keys of the range, oldest first (at most 400). */
function daysOf(range: DayRange) {
  const days: string[] = []
  const end = Date.parse(`${range.to}T12:00:00+03:00`)
  for (
    let time = Date.parse(`${range.from}T12:00:00+03:00`);
    time <= end && days.length < 400;
    time += DAY_MS
  ) {
    days.push(istanbulDayKey(new Date(time)))
  }
  return days
}

function average(values: readonly number[]) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
}

/** Newest first; equal times: the later row first. */
function newestFirst(a: StoredEvent, b: StoredEvent) {
  return b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id - a.id
}

function explorerRows(data: MemberRows, explorers: readonly Explorer[]): ExplorerRow[] {
  const events = liveEvents(data.events)
  return explorers.map((explorer) => {
    const mine = data.progress.filter((row) => row.explorerId === explorer.id)
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
      badges: data.badges.filter((row) => row.explorerId === explorer.id).length,
      qrScans: events.filter(
        (row) => row.event.explorerId === explorer.id && row.event.type === 'qr_scan',
      ).length,
      devices: data.devices.filter((row) => row.explorerId === explorer.id).length,
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

/** The Studio home dashboard. Explorer names in the feed only when `includeExplorer` (admins). */
export function computeDashboard(
  data: Pick<AnalyticsData, 'events' | 'explorers' | 'kits' | 'versions' | 'now'>,
  { includeExplorer }: { includeExplorer: boolean },
): DashboardStats {
  const infos = kitInfos(data)
  const events = liveEvents(data.events)
  const { now } = data
  const today = istanbulDayKey(new Date(now))
  const weekDays = new Set(lastDayKeys(7, new Date(now)))
  const explorers = new Map(data.explorers.map((explorer) => [explorer.id, explorer]))
  const previewOnly = previewOnlyExplorerIds(data.events)
  const members = [...explorers.values()].filter((explorer) => !previewOnly.has(explorer.id))

  const monthAgo = now - 30 * DAY_MS
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
  for (const kitId of new Set([...starts.keys(), ...completions.keys(), ...Object.keys(perKit)])) {
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

  const feed = events
    .toSorted(newestFirst)
    .slice(0, 25)
    .map((row) => toFeedItem(row, infos, explorers, includeExplorer))

  // Equal counts keep the order of each card's first scan.
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
      newExplorersToday: members.filter((explorer) => istanbulDayKey(explorer.createdAt) === today)
        .length,
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
}

/** One kit's analytics for a range of Istanbul days; `null` when the kit does not exist. */
export function computeKitStats(
  data: Pick<AnalyticsData, 'events' | 'kits' | 'versions'>,
  kitId: string,
  range: DayRange,
): KitStats | null {
  const info = kitInfos(data).get(kitId)
  if (!info) return null
  const events = liveEvents(data.events)
    .map((row) => row.event)
    .filter((event) => event.kitId === kitId && inRange(event.occurredAt, range))
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
    if (row) row[istanbulHour(event.occurredAt)] = (row[istanbulHour(event.occurredAt)] ?? 0) + 1
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
    return {
      stepId: step.id,
      title: step.title,
      code: step.qrCode,
      opens: stats?.opens.size ?? 0,
      completes: stats?.completes.size ?? 0,
      avgDurationMs: average(stats?.durations ?? []),
    }
  })
  // Equal drop rates keep the card order.
  const mostDropped =
    funnel
      .filter((step) => step.opens >= 1)
      .map((step) => ({
        stepId: step.stepId,
        title: step.title,
        dropRate: step.opens > 0 ? 1 - step.completes / step.opens : 0,
      }))
      .toSorted((a, b) => b.dropRate - a.dropRate)[0] ?? null

  return {
    totals: {
      opens: kitOpens.size,
      starts: kitOpens.size,
      completions: kitCompletes.size,
      scans,
      avgKitDurationMs: average(kitDurations),
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
}

/** One page of the member list (most recently seen first). */
export function computeExplorerPage(
  data: Pick<AnalyticsData, 'explorers' | 'events' | 'progress' | 'badges' | 'devices'>,
  filter: ExplorerFilter,
): ExplorerPage {
  const needle = filter.query.trim().toLocaleLowerCase('tr')
  const previewOnly = previewOnlyExplorerIds(data.events)
  const matching = data.explorers
    .filter((explorer) => !previewOnly.has(explorer.id))
    .filter(
      (explorer) =>
        !needle ||
        explorer.nickname.toLocaleLowerCase('tr').includes(needle) ||
        explorer.displayCode.toLowerCase().includes(needle.replace('#', '')),
    )
    .filter((explorer) => {
      if (filter.kitId === 'all' && filter.completed === 'all') return true
      const mine = data.progress.filter(
        (row) =>
          row.explorerId === explorer.id && (filter.kitId === 'all' || row.kitId === filter.kitId),
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
    items: explorerRows(data, matching.slice((page - 1) * filter.pageSize, page * filter.pageSize)),
    total: matching.length,
    page,
    pageCount,
  }
}

/** One member's row, timeline (previews included), kits and badges; `null` when unknown. */
export function computeExplorerDetail(
  data: Omit<AnalyticsData, 'now'>,
  explorerId: string,
): ExplorerDetail | null {
  const explorer = data.explorers.find((row) => row.id === explorerId)
  if (!explorer) return null
  const infos = kitInfos(data)
  const explorers = new Map([[explorer.id, explorer]])
  const [row] = explorerRows(data, [explorer])
  if (!row) return null
  return {
    row,
    timeline: data.events
      .filter((stored) => stored.event.explorerId === explorerId)
      .toSorted(newestFirst)
      .map((stored) => toFeedItem(stored, infos, explorers, true)),
    kits: data.progress
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
    badges: data.badges
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
}

/** KVKK m.11: everything stored about one member (no Kâşif kodu); `null` when unknown. */
export function computeExplorerExport(
  data: Pick<AnalyticsData, 'explorers' | 'events' | 'progress' | 'badges' | 'devices' | 'now'>,
  explorerId: string,
): Record<string, unknown> | null {
  const explorer = data.explorers.find((row) => row.id === explorerId)
  if (!explorer) return null
  return {
    exportedAt: new Date(data.now).toISOString(),
    note: EXPLORER_EXPORT_NOTE,
    explorer,
    devices: data.devices
      .filter((row) => row.explorerId === explorerId)
      .map(({ linkedAt, lastSeenAt }) => ({ linkedAt, lastSeenAt })),
    progress: data.progress.filter((row) => row.explorerId === explorerId),
    badges: data.badges.filter((row) => row.explorerId === explorerId),
    events: data.events
      .filter((row) => row.event.explorerId === explorerId)
      // oxlint-disable-next-line oxc/no-map-spread -- rows may be cached table objects: copy, never mutate them in place
      .map((row) => ({ ...row.event, receivedAt: row.receivedAt })),
  }
}

/** Centre-wide numbers for a range of Istanbul days. */
export function computeOverview(
  data: Pick<AnalyticsData, 'events' | 'explorers' | 'kits' | 'versions' | 'now'>,
  range: DayRange,
): OverviewStats {
  const infos = kitInfos(data)
  const events = liveEvents(data.events)
    .map((row) => row.event)
    .filter((event) => inRange(event.occurredAt, range))
  const days = daysOf(range)
  const uniques = new Set(events.map((event) => event.explorerId))
  const firstSeen = new Map(
    data.explorers.map((explorer) => [explorer.id, istanbulDayKey(explorer.createdAt)]),
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
    avgVisitMs: average(visitDurations),
    events: events.length,
    daily: days.map((day) => {
      const dayEvents = events.filter((event) => istanbulDayKey(event.occurredAt) === day)
      return {
        day,
        uniques: new Set(dayEvents.map((event) => event.explorerId)).size,
        events: dayEvents.length,
      }
    }),
    // Equal starts keep the kit order.
    kits: kits
      .filter((kit) => kit.starts > 0 || kit.scans > 0)
      .toSorted((a, b) => b.starts - a.starts),
    rangeWithinRetention: data.now - oldest <= RAW_RETENTION_DAYS * DAY_MS,
  }
}

/** Rows of the events CSV: live events of the range, oldest first, with explorers named. */
export function computeCsvItems(
  data: Pick<AnalyticsData, 'events' | 'explorers' | 'kits' | 'versions'>,
  range: DayRange,
): FeedItem[] {
  const infos = kitInfos(data)
  const explorers = new Map(data.explorers.map((explorer) => [explorer.id, explorer]))
  return liveEvents(data.events)
    .filter((row) => inRange(row.event.occurredAt, range))
    .toSorted((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt))
    .map((row) => toFeedItem(row, infos, explorers, true))
}

/** The events CSV of the Analytics page, built from its rows (both adapters share it). */
export function analyticsCsv(items: readonly FeedItem[]) {
  return toCsv(
    ANALYTICS_CSV_HEADERS,
    items.map((item) => [
      item.at,
      item.explorer ? `${item.explorer.nickname} #${item.explorer.displayCode}` : '',
      item.type,
      item.kitTitle ?? '',
      item.stepTitle ?? '',
      item.code ?? '',
      item.source ?? '',
      item.durationMs ?? '',
      item.correct === null ? '' : item.correct ? 'doğru' : 'yanlış',
    ]),
  )
}
