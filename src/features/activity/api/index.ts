import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockEventSink, createMockProgressService } from './activity.mock'
import { createSupabaseEventSink, createSupabaseProgressService } from './activity.supabase'
import type { EventSink, ProgressService } from './port'
import { configureQueue } from './queue'

export const eventSink: EventSink = isSupabaseBackend
  ? createSupabaseEventSink()
  : createMockEventSink()
export const progressService: ProgressService = isSupabaseBackend
  ? createSupabaseProgressService()
  : createMockProgressService()

configureQueue({ sink: eventSink })

export type * from './port'
