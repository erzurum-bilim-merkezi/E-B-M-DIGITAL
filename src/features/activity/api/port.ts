import type { ActivityEvent } from '@/entities/activity'
import type { EarnedBadge, ExplorerProgress } from '@/entities/explorer'

export type SendResult = {
  accepted: number
  duplicates: number
  rejected: number
  /** Badges the server awarded while processing this batch (for the celebration). */
  newBadges: EarnedBadge[]
}

/** `record_events` RPC: idempotent (client_event_id), batched (≤ 50), rate limited. */
export type EventSink = {
  send(events: readonly ActivityEvent[]): Promise<SendResult>
}

/** Server copy of a member's progress and badges (the device only caches). */
export type ProgressService = {
  list(explorerId: string): Promise<ExplorerProgress[]>
  badges(explorerId: string): Promise<EarnedBadge[]>
  /** "Baştan başla": clears the completed cards of one kit; badges stay. */
  resetKit(explorerId: string, kitId: string): Promise<void>
}
