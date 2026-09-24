import { createMockAiService } from './ai.mock'
import type { AiService } from './port'

// The real adapter calls the `ai-generate` Edge Function (Gemini free tier, key only in
// Supabase secrets — never VITE_*). Until then: the deterministic fake provider.
export const aiService: AiService = createMockAiService()

export type * from './port'
