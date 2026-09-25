import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockExplorerService } from './explorer.mock'
import { createSupabaseExplorerService } from './explorer.supabase'
import type { ExplorerService } from './port'

export const explorerService: ExplorerService = isSupabaseBackend
  ? createSupabaseExplorerService()
  : createMockExplorerService()

export type * from './port'
