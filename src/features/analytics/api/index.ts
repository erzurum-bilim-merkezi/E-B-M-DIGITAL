import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockAnalyticsReader } from './analytics.mock'
import { createSupabaseAnalyticsReader } from './analytics.supabase'
import type { AnalyticsReader } from './port'

export const analyticsReader: AnalyticsReader = isSupabaseBackend
  ? createSupabaseAnalyticsReader()
  : createMockAnalyticsReader()

export type * from './port'
