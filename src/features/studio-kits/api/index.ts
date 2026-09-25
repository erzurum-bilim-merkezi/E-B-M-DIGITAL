import { isSupabaseBackend } from '@/shared/config/backend'

import type { KitRepository, PublishingService, QrRegistry } from './port'
import {
  createMockKitRepository,
  createMockPublishingService,
  createMockQrRegistry,
} from './studio-kits.mock'
import {
  createSupabaseKitRepository,
  createSupabasePublishingService,
  createSupabaseQrRegistry,
} from './studio-kits.supabase'

// Adapter selection (ADR 0015).
export const kitRepository: KitRepository = isSupabaseBackend
  ? createSupabaseKitRepository()
  : createMockKitRepository()
export const publishingService: PublishingService = isSupabaseBackend
  ? createSupabasePublishingService()
  : createMockPublishingService()
export const qrRegistry: QrRegistry = isSupabaseBackend
  ? createSupabaseQrRegistry()
  : createMockQrRegistry()

export type * from './port'
