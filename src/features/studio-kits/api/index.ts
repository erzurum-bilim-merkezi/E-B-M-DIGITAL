import type { KitRepository, PublishingService, QrRegistry } from './port'
import {
  createMockKitRepository,
  createMockPublishingService,
  createMockQrRegistry,
} from './studio-kits.mock'

// Adapter selection (ADR 0015). Supabase adapters arrive with F4.
export const kitRepository: KitRepository = createMockKitRepository()
export const publishingService: PublishingService = createMockPublishingService()
export const qrRegistry: QrRegistry = createMockQrRegistry()

export type * from './port'
