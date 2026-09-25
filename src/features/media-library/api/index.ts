import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockMediaRepository } from './media.mock'
import { createSupabaseMediaRepository } from './media.supabase'
import type { MediaRepository } from './port'

export const mediaRepository: MediaRepository = isSupabaseBackend
  ? createSupabaseMediaRepository()
  : createMockMediaRepository()

export type * from './port'
