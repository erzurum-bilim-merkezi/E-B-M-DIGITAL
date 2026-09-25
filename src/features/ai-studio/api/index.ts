import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockAiService } from './ai.mock'
import { createSupabaseAiService } from './ai.supabase'
import type { AiService } from './port'

// Supabase: the `ai-generate` Edge Function (Gemini free tier, key only in the function's secrets
// — never VITE_*). Mock backend: the deterministic fake provider.
export const aiService: AiService = isSupabaseBackend
  ? createSupabaseAiService()
  : createMockAiService()

export type * from './port'
