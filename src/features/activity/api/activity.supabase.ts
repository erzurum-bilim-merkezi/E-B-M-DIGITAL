import { z } from 'zod'

import { eventBatchSchema } from '@/entities/activity'
import { earnedBadgeSchema, explorerProgressSchema } from '@/entities/explorer'
import { AppError } from '@/shared/api/errors'
import {
  currentDeviceId,
  ensureDeviceSession,
  kidsClient,
  toAppError,
  unwrap,
} from '@/shared/api/supabase'

import type { EventSink, ProgressService } from './port'

/*
 * Activity on Supabase (ADR 0012): the offline queue flushes batches into the record_events RPC,
 * which also keeps progress and badges; the device reads its own members' progress under RLS.
 */

const sendResultSchema = z.object({
  accepted: z.int(),
  duplicates: z.int(),
  rejected: z.int(),
  newBadges: z.array(earnedBadgeSchema),
})

const PROGRESS_COLUMNS =
  'explorerId:explorer_id, kitId:kit_id, startedAt:started_at, completedAt:completed_at, completedSteps:completed_steps, qrScans:qr_scans, totalDurationMs:total_duration_ms'
const BADGE_COLUMNS = 'explorerId:explorer_id, badgeId:badge_id, kitId:kit_id, earnedAt:earned_at'

export function createSupabaseEventSink(): EventSink {
  return {
    async send(events) {
      // Same boundary check as the mock: a malformed batch never leaves the device.
      const batch = eventBatchSchema.safeParse(events)
      if (!batch.success) throw new AppError('validation', 'Olay paketi geçersiz.')
      await ensureDeviceSession().catch((error: unknown) => {
        throw toAppError(error)
      })
      return sendResultSchema.parse(
        unwrap(await kidsClient().rpc('record_events', { p_events: batch.data })),
      )
    },
  }
}

export function createSupabaseProgressService(): ProgressService {
  return {
    async list(explorerId) {
      if (!(await currentDeviceId())) return []
      const rows = unwrap(
        await kidsClient()
          .from('explorer_kit_progress')
          .select(PROGRESS_COLUMNS)
          .eq('explorer_id', explorerId),
      )
      return z.array(explorerProgressSchema).parse(rows)
    },
    async badges(explorerId) {
      if (!(await currentDeviceId())) return []
      const rows = unwrap(
        await kidsClient()
          .from('explorer_badges')
          .select(BADGE_COLUMNS)
          .eq('explorer_id', explorerId)
          .order('earned_at', { ascending: false }),
      )
      return z.array(earnedBadgeSchema).parse(rows)
    },
    async resetKit(explorerId, kitId) {
      await ensureDeviceSession().catch((error: unknown) => {
        throw toAppError(error)
      })
      unwrap(await kidsClient().rpc('reset_kit_progress', { p_explorer: explorerId, p_kit: kitId }))
    },
  }
}
