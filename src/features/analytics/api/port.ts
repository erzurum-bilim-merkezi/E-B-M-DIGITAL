import type { ActivityType, QrScanSource } from '@/entities/activity'
import type { Avatar } from '@/entities/explorer'

export type DayRange = { from: string; to: string }

export type FeedItem = {
  id: number
  at: string
  type: ActivityType
  /** `null` for editors — explorer-level data is admin-only (KVKK). */
  explorer: { id: string; nickname: string; displayCode: string; avatar: Avatar } | null
  kitTitle: string | null
  stepTitle: string | null
  code: string | null
  source: QrScanSource | null
  durationMs: number | null
  correct: boolean | null
  badgeName: string | null
}

export type KitSummaryStats = {
  scans7d: number
  starts: number
  completions: number
  completionRate: number
}

export type DashboardStats = {
  kpis: {
    activeToday: number
    activeLast15m: number
    qrScansToday: number
    kitsCompletedThisWeek: number
    newExplorersToday: number
    /** Unique explorers with activity in the last 30 days (Supabase MAU quota proxy). */
    monthlyActive: number
  }
  trend: { day: string; activeExplorers: number; qrScans: number }[]
  topCards: {
    kitId: string
    kitTitle: string
    stepId: string
    stepTitle: string
    code: string
    scans: number
  }[]
  feed: FeedItem[]
  perKit: Record<string, KitSummaryStats>
  totals: { explorers: number; events: number }
}

export type KitStats = {
  totals: {
    opens: number
    starts: number
    completions: number
    scans: number
    avgKitDurationMs: number
  }
  funnel: {
    stepId: string
    title: string
    code: string
    opens: number
    completes: number
    avgDurationMs: number
  }[]
  scansBySource: { code: string; title: string; camera: number; inApp: number; manual: number }[]
  quiz: { stepId: string; title: string; correct: number; total: number }[]
  mostDropped: { stepId: string; title: string; dropRate: number } | null
  /** [weekday 0=Mon][hour 0–23] event counts (Europe/Istanbul). */
  heatmap: number[][]
  trend: { day: string; opens: number; completes: number }[]
}

export type ExplorerRow = {
  id: string
  nickname: string
  displayCode: string
  avatar: Avatar
  createdAt: string
  lastSeenAt: string
  createdVia: 'self' | 'center'
  kitsStarted: number
  kitsCompleted: number
  badges: number
  qrScans: number
  devices: number
}

export type ExplorerFilter = {
  query: string
  page: number
  pageSize: number
  kitId: string | 'all'
  completed: 'all' | 'yes' | 'no'
}

export type ExplorerPage = { items: ExplorerRow[]; total: number; page: number; pageCount: number }

export type ExplorerDetail = {
  row: ExplorerRow
  timeline: FeedItem[]
  kits: {
    kitId: string
    title: string
    completedSteps: number
    totalSteps: number
    completedAt: string | null
    startedAt: string
  }[]
  badges: { badgeId: string; name: string; emoji: string; earnedAt: string }[]
}

export type OverviewStats = {
  uniqueExplorers: number
  newExplorers: number
  returningExplorers: number
  avgVisitMs: number
  events: number
  daily: { day: string; uniques: number; events: number }[]
  kits: {
    kitId: string
    title: string
    starts: number
    completions: number
    completionRate: number
    scans: number
  }[]
  /** Raw events are kept for 60 days; older ranges are approximated by daily totals. */
  rangeWithinRetention: boolean
}

export type AnalyticsReader = {
  dashboard(): Promise<DashboardStats>
  kitStats(kitId: string, range: DayRange): Promise<KitStats>
  explorers(filter: ExplorerFilter): Promise<ExplorerPage>
  explorerDetail(explorerId: string): Promise<ExplorerDetail>
  /** KVKK m.11 — everything stored about one explorer, as JSON. */
  exportExplorer(explorerId: string): Promise<Record<string, unknown>>
  deleteExplorer(explorerId: string): Promise<void>
  overview(range: DayRange): Promise<OverviewStats>
  exportCsv(range: DayRange): Promise<string>
}
