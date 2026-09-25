import { z } from 'zod'

import {
  aiSceneStateSchema,
  checkAiSvg,
  kitCategorySchema,
  AI_ICON_MAX_BYTES,
} from '@/entities/kit'
import { appSettingsSchema, mediaAssetSchema, type MediaAsset } from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { publicObjectUrl, staffClient, toAppError, unwrap } from '@/shared/api/supabase'

import { AI_TIMEOUT_MS, composeKit, kitBlockTypes } from './compose'
import type { AiQuota, AiService, AiStage, RunOptions } from './port'

/*
 * AI assistance on Supabase (ADR 0018): the `ai-generate` Edge Function calls the provider
 * (Gemini free tier, or the deterministic fake on the local stack), checks the caller, the
 * personal-data rule and the daily quota, and records every attempt. The key never leaves the
 * function's secrets. Drafts come back as plain texts and are composed into cards here with the
 * same code as the mock (compose.ts); SVGs are checked again before anything is shown or saved.
 */

const FUNCTION = 'ai-generate'

const quotaSchema = z.object({
  provider: appSettingsSchema.shape.aiProvider,
  userUsed: z.int().nonnegative(),
  userLimit: z.int().nonnegative(),
  projectUsed: z.int().nonnegative(),
  projectLimit: z.int().nonnegative(),
  suggestionCount: z.int().min(1),
  resetsAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<AiQuota>

const cardTextSchema = z.object({
  title: z.string(),
  answer: z.string(),
  narration: z.string(),
  hint: z.string(),
  celebration: z.string(),
  options: z.array(z.string()),
  correctCount: z.int().nonnegative(),
})

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      alt: z.string(),
      states: z.array(z.object({ state: z.string(), svg: z.string() })),
    }),
  ),
})

const savedSceneSchema = z.object({
  kind: z.literal('ai-scene'),
  alt: z.string().max(240),
  states: z.array(aiSceneStateSchema).min(1).max(8),
})

const kitDraftSchema = z.object({
  kit: z.object({
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    category: kitCategorySchema,
    learningObjectives: z.array(z.string()),
    badgeName: z.string(),
  }),
  cards: z.array(cardTextSchema),
})

const mediaRowSchema = mediaAssetSchema.omit({ url: true }).extend({ path: z.string() })

/** The function's error answer (`errorResponse` of supabase/functions/_shared/http.ts). */
const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

const MESSAGES = {
  timeout: 'Yapay zekâ 120 saniye içinde yanıt vermedi. Tekrar deneyin.',
  scene: 'Üretilen çizim güvenlik kontrolünden geçemedi ve reddedildi. Farklı bir istem deneyin.',
  icon: 'Üretilen ikon güvenlik kontrolünden geçemedi.',
  savedScene: 'Sahne güvenlik kontrolünden geçemedi.',
  savedIcon: 'İkon güvenlik kontrolünden geçemedi.',
}

function cancelled() {
  return new DOMException('İptal edildi', 'AbortError')
}

function isSafeScene(svg: string) {
  return checkAiSvg(svg).length === 0
}

function isSafeIcon(svg: string) {
  return checkAiSvg(svg, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false }).length === 0
}

function hasName(value: unknown, names: readonly string[]) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    names.includes(value.name)
  )
}

/** A failed `functions.invoke` → the AppError of the port (or the AbortError of a cancel). */
async function invokeError(error: unknown, signal: AbortSignal | undefined): Promise<Error> {
  if (signal?.aborted) return cancelled()
  const context: unknown =
    typeof error === 'object' && error !== null && 'context' in error ? error.context : null
  if (context instanceof Response) {
    // FunctionsHttpError / FunctionsRelayError carry the function's JSON answer.
    const parsed = errorBodySchema.safeParse(await context.json().catch(() => null))
    if (!parsed.success) return toAppError({ status: context.status })
    const { code, message, details = {} } = parsed.data
    // KS500 is the function's "unavailable" with its own Turkish text (time-out, bad output).
    if (code === 'KS500') return new AppError('unavailable', message, details)
    return toAppError({ code, message, details })
  }
  if (hasName(error, ['FunctionsFetchError'])) {
    // No answer at all: our own time-out (invoke aborts after AI_TIMEOUT_MS) or the network.
    return hasName(context, ['AbortError', 'TimeoutError'])
      ? new AppError('unavailable', MESSAGES.timeout)
      : new AppError('network')
  }
  return toAppError(error)
}

async function invoke(body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const { data, error } = await staffClient().functions.invoke(FUNCTION, {
    body,
    signal,
    timeout: AI_TIMEOUT_MS,
  })
  if (error) throw await invokeError(error, signal)
  return data
}

/**
 * One generation with progress: queued → drawing (request on its way) → checking (answer being
 * checked, drawings only) → done. A cancel rejects with an AbortError like the mock.
 */
async function generate<T>(
  body: Record<string, unknown>,
  options: RunOptions | undefined,
  parse: (data: unknown) => T,
  { checking }: { checking: boolean },
): Promise<T> {
  const started = Date.now()
  const report = (stage: AiStage) =>
    options?.onProgress?.({ stage, elapsedMs: Date.now() - started })
  const signal = options?.signal
  if (signal?.aborted) throw cancelled()
  report('queued')
  const pending = invoke(body, signal)
  report('drawing')
  const data = await pending
  if (signal?.aborted) throw cancelled()
  if (checking) report('checking')
  const result = parse(data)
  report('done')
  return result
}

export function createSupabaseAiService(): AiService {
  return {
    async quota() {
      return quotaSchema.parse(unwrap(await staffClient().rpc('ai_quota')))
    },

    async generateScene(request, options) {
      return generate(
        { action: 'scene', ...request },
        options,
        (data) => {
          const { suggestions } = suggestionsSchema.parse(data)
          // Defence in depth: the function already rejected unsafe drawings.
          const safe = suggestions.filter(
            (suggestion) =>
              suggestion.states.map((entry) => entry.state).join() === request.states.join() &&
              suggestion.states.every((entry) => isSafeScene(entry.svg)),
          )
          if (safe.length === 0) throw new AppError('validation', MESSAGES.scene)
          return safe
        },
        { checking: true },
      )
    },

    async saveScene(suggestion) {
      if (!suggestion.states.every((entry) => isSafeScene(entry.svg))) {
        throw new AppError('validation', MESSAGES.savedScene)
      }
      return savedSceneSchema.parse(await invoke({ action: 'save-scene', suggestion }))
    },

    async generateIcons(concept, options) {
      return generate(
        { action: 'icons', concept },
        options,
        (data) => {
          const icons = z
            .object({ icons: z.array(z.string()) })
            .parse(data)
            .icons.filter(isSafeIcon)
          if (icons.length === 0) throw new AppError('validation', MESSAGES.icon)
          return icons
        },
        { checking: true },
      )
    },

    async saveIcon(svg, concept): Promise<MediaAsset> {
      if (!isSafeIcon(svg)) throw new AppError('validation', MESSAGES.savedIcon)
      const { path, ...asset } = mediaRowSchema.parse(
        await invoke({ action: 'save-icon', svg, concept }),
      )
      return { ...asset, url: publicObjectUrl('media', path) }
    },

    async draftCardText(request, options) {
      return generate(
        { action: 'card-text', ...request },
        options,
        (data) => cardTextSchema.parse(data),
        { checking: false },
      )
    },

    async draftKit(request, options) {
      const blockTypes = kitBlockTypes(request.cardCount)
      return generate(
        {
          action: 'kit',
          topic: request.topic,
          ageMin: request.ageMin,
          ageMax: request.ageMax,
          blockTypes,
        },
        options,
        (data) => {
          const { kit, cards } = kitDraftSchema
            .extend({ cards: kitDraftSchema.shape.cards.length(blockTypes.length) })
            .parse(data)
          return composeKit(request, kit, cards)
        },
        { checking: true },
      )
    },
  }
}
