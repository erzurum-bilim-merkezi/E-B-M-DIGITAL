import { createMockAnalyticsReader } from './analytics.mock'
import type { AnalyticsReader } from './port'

export const analyticsReader: AnalyticsReader = createMockAnalyticsReader()

export type * from './port'
