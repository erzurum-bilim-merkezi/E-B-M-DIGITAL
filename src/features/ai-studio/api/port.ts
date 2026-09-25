import type { BlockType, KitDocument, Visual } from '@/entities/kit'
import type { AppSettings, MediaAsset } from '@/entities/studio'

export type AiQuota = {
  provider: AppSettings['aiProvider']
  userUsed: number
  userLimit: number
  projectUsed: number
  projectLimit: number
  suggestionCount: number
  /** Next reset (00:00 Europe/Istanbul). */
  resetsAt: string
}

export type AiStage = 'queued' | 'drawing' | 'checking' | 'done'
export type AiProgress = { stage: AiStage; elapsedMs: number }

export type SceneRequest = {
  title: string
  answer: string
  blockType: BlockType
  /** Required states incl. `static`. */
  states: string[]
  prompt: string
}

export type SceneSuggestion = {
  id: string
  alt: string
  states: { state: string; svg: string }[]
}

export type CardTextRequest = {
  topic: string
  blockType: BlockType
  title: string
  ageMin: number
  ageMax: number
}

export type CardTextDraft = {
  title: string
  answer: string
  narration: string
  hint: string
  celebration: string
  /** Choice-style blocks: option labels (first `correctCount` are correct). */
  options: string[]
  correctCount: number
}

export type KitDraftRequest = { topic: string; ageMin: number; ageMax: number; cardCount: number }

export type RunOptions = { signal?: AbortSignal; onProgress?: (progress: AiProgress) => void }

/** Provider-independent AI port (ADR 0018). Mock = fake provider; the Edge Function wraps Gemini. */
export type AiService = {
  quota(): Promise<AiQuota>
  generateScene(request: SceneRequest, options?: RunOptions): Promise<SceneSuggestion[]>
  /** Stores the chosen suggestion's SVGs as media and returns the card visual. */
  saveScene(suggestion: SceneSuggestion): Promise<Extract<Visual, { kind: 'ai-scene' }>>
  generateIcons(concept: string, options?: RunOptions): Promise<string[]>
  saveIcon(svg: string, concept: string): Promise<MediaAsset>
  draftCardText(request: CardTextRequest, options?: RunOptions): Promise<CardTextDraft>
  draftKit(
    request: KitDraftRequest,
    options?: RunOptions,
  ): Promise<Omit<KitDocument, 'id' | 'slug' | 'qrPrefix'>>
}
