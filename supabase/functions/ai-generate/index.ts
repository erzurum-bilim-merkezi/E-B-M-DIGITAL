// ai-generate (ADR 0018): the Studio's AI assistance — card texts, kit drafts, scene and icon
// SVGs — and storing the chosen drawings in the media library. Only active staff get past the
// first step: ai_quota() runs with the caller's own JWT and raises for everyone else. The provider
// is Gemini (free tier; the key is the GEMINI_API_KEY secret only) or the deterministic fake, as
// both the AI_PROVIDER secret and the admin's setting allow. Every generation attempt is recorded
// in ai_usage; only successful ones count towards the daily quota. Drawings are checked with the
// app's own contract (checkAiSvg) and rejected, never repaired. Prompts and keys are never logged.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  checkAiSvg,
  findPii,
  KIT_CATEGORIES,
  sceneStateSchema,
  svgDescription,
  AI_ICON_MAX_BYTES,
  type BlockType,
} from '../_shared/entities/kit/index.ts'
import { createFakeProvider } from '../_shared/fake-ai.ts'
import {
  AiProviderError,
  createGeminiProvider,
  isWellFormedSvg,
  resolveProvider,
  GEMINI_TIMEOUT_MS,
  type AiProvider,
  type Generated,
  type ProviderName,
} from '../_shared/gemini.ts'
import {
  allowedOrigin,
  corsHeaders,
  errorResponse,
  failures,
  fromRpcError,
  HttpFailure,
  json,
} from '../_shared/http.ts'

// ---------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------

const blockType = z.enum(BLOCK_TYPES)
const age = z.int().min(3).max(14)
const svg = z.string().min(1).max(20_000)
const states = z
  .array(sceneStateSchema)
  .min(1)
  .max(8)
  .refine((list) => new Set(list).size === list.length)

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('card-text'),
    topic: z.string().max(200),
    title: z.string().max(200),
    blockType,
    ageMin: age,
    ageMax: age,
  }),
  z.object({
    action: z.literal('kit'),
    topic: z.string().trim().min(1).max(200),
    ageMin: age,
    ageMax: age,
    blockTypes: z.array(blockType).min(1).max(12),
  }),
  z.object({
    action: z.literal('scene'),
    title: z.string().max(200),
    answer: z.string().max(2000),
    blockType,
    states,
    prompt: z.string().max(1000),
  }),
  z.object({ action: z.literal('icons'), concept: z.string().trim().min(1).max(120) }),
  z.object({
    action: z.literal('save-scene'),
    suggestion: z.object({
      alt: z.string().max(1000),
      states: z
        .array(z.object({ state: sceneStateSchema, svg }))
        .min(1)
        .max(8)
        .refine((list) => new Set(list.map((entry) => entry.state)).size === list.length),
    }),
  }),
  z.object({ action: z.literal('save-icon'), svg, concept: z.string().max(120) }),
])

type Body = z.infer<typeof bodySchema>
type GenerationBody = Extract<Body, { action: 'card-text' | 'kit' | 'scene' | 'icons' }>

const quotaSchema = z.object({
  provider: z.enum(['gemini', 'fake', 'off']),
  userUsed: z.number(),
  userLimit: z.number(),
  projectUsed: z.number(),
  projectLimit: z.number(),
  suggestionCount: z.int().min(1).max(3),
  resetsAt: z.string(),
})

type Context = {
  admin: SupabaseClient
  userId: string
  quota: z.infer<typeof quotaSchema>
  signal: AbortSignal
}

// ---------------------------------------------------------------------------------------------
// Answers (the mock backend's Turkish messages, features/ai-studio/api/ai.mock.ts)
// ---------------------------------------------------------------------------------------------

const MESSAGES = {
  off: 'Yapay zekâ bu kurulumda kapalı.',
  pii: 'İstemde kişisel veri (e-posta, telefon ya da kimlik no) var. Lütfen çıkarın.',
  quota: 'Bugünkü ücretsiz yapay zekâ kotası doldu. Kota gece 00:00’da (İstanbul) yenilenir.',
  filter: 'Bu istek güvenlik filtresine takıldı ve üretilemedi. İstemi değiştirip tekrar deneyin.',
  timeout: 'Yapay zekâ 120 saniye içinde yanıt vermedi. Tekrar deneyin.',
  sceneRejected:
    'Üretilen çizim güvenlik kontrolünden geçemedi ve reddedildi. Farklı bir istem deneyin.',
  iconRejected: 'Üretilen ikon güvenlik kontrolünden geçemedi.',
  sceneUnsafe: 'Sahne güvenlik kontrolünden geçemedi.',
  iconUnsafe: 'İkon güvenlik kontrolünden geçemedi.',
  providerQuota:
    'Yapay zekâ hizmetinin bugünkü ücretsiz kullanım sınırı doldu. Daha sonra tekrar deneyin.',
  providerBusy: 'Yapay zekâ hizmeti şu an çok yoğun. Bir dakika sonra tekrar deneyin.',
  invalid: 'Yapay zekâ kullanılabilir bir yanıt üretemedi. Tekrar deneyin.',
}

/** An HttpFailure with a JSON detail for the app (AppError.details), e.g. the quota reset. */
class DetailedFailure extends HttpFailure {
  readonly details: Record<string, unknown>

  constructor(failure: HttpFailure, details: Record<string, unknown>) {
    super(failure.status, failure.code, failure.message)
    this.details = details
  }
}

function answerError(error: unknown, origin: string | null) {
  if (error instanceof DetailedFailure) {
    return json(
      { code: error.code, message: error.message, details: error.details },
      error.status,
      origin,
    )
  }
  return errorResponse(error, origin)
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

const MEDIA_COLUMNS =
  'id, kind, name, mime, bytes, width, height, durationSec:duration_sec, alt, path, source, sceneGroup:scene_group, sceneState:scene_state, createdBy:created_by, createdAt:created_at'

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw failures.unavailable()
  return value
}

async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw fromRpcError(error)
  return data as unknown
}

function isSafeScene(markup: string) {
  return checkAiSvg(markup).length === 0 && isWellFormedSvg(markup)
}

function isSafeIcon(markup: string) {
  return (
    checkAiSvg(markup, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false }).length === 0 &&
    markup.includes('viewBox="0 0 64 64"') &&
    isWellFormedSvg(markup)
  )
}

function block(type: BlockType) {
  const meta = BLOCK_CATALOG[type]
  return { blockType: type, blockLabel: meta.label, blockDescription: meta.description }
}

/** Everything of the request that reaches the provider (personal data must never do). */
function promptText(body: GenerationBody) {
  switch (body.action) {
    case 'card-text':
      return `${body.topic} ${body.title}`
    case 'kit':
      return body.topic
    case 'scene':
      return `${body.prompt} ${body.title} ${body.answer}`
    case 'icons':
      return body.concept
  }
}

const USAGE_KIND = { 'card-text': 'text', kit: 'kit', scene: 'scene', icons: 'icon' } as const

async function recordUsage(
  context: Context,
  entry: {
    kind: (typeof USAGE_KIND)[keyof typeof USAGE_KIND]
    status: 'ok' | 'blocked' | 'error'
    provider: Exclude<ProviderName, 'off'>
    model: string
    inputTokens: number | null
    outputTokens: number | null
  },
) {
  const { error } = await context.admin.from('ai_usage').insert({
    user_id: context.userId,
    kind: entry.kind,
    status: entry.status,
    provider: entry.provider,
    model: entry.model.slice(0, 80),
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
  })
  // The answer is not withheld for a lost counter row; the log says so (no prompt in it).
  if (error) console.error(`ai_usage insert failed: ${error.code ?? ''}`)
}

function providerFor(name: Exclude<ProviderName, 'off'>): AiProvider {
  if (name === 'fake') return createFakeProvider()
  return createGeminiProvider({
    apiKey: env('GEMINI_API_KEY'),
    model: Deno.env.get('GEMINI_MODEL'),
    lightModel: Deno.env.get('GEMINI_MODEL_LIGHT'),
  })
}

/** Sums the token counts of several calls (null when none reported any). */
function tokens(results: readonly Generated<unknown>[], key: 'inputTokens' | 'outputTokens') {
  const counts = results.map((result) => result[key]).filter((value) => value !== null)
  return counts.length > 0 ? counts.reduce((sum, value) => sum + value, 0) : null
}

type Outcome = { answer: unknown; results: Generated<unknown>[] }

async function run(
  provider: AiProvider,
  body: GenerationBody,
  suggestionCount: number,
  signal: AbortSignal,
): Promise<Outcome> {
  switch (body.action) {
    case 'card-text': {
      const result = await provider.cardText(
        {
          ...block(body.blockType),
          topic: body.topic,
          title: body.title,
          ageMin: body.ageMin,
          ageMax: body.ageMax,
        },
        signal,
      )
      return { answer: result.value, results: [result] }
    }
    case 'kit': {
      const result = await provider.kit(
        {
          topic: body.topic,
          ageMin: body.ageMin,
          ageMax: body.ageMax,
          categories: KIT_CATEGORIES,
          cards: body.blockTypes.map(block),
        },
        signal,
      )
      return { answer: result.value, results: [result] }
    }
    case 'scene': {
      const input = {
        title: body.title,
        answer: body.answer,
        prompt: body.prompt,
        blockLabel: BLOCK_CATALOG[body.blockType].label,
        states: body.states,
      }
      // One call per suggestion, in parallel; a failed call only costs its own suggestion.
      const settled = await Promise.allSettled(
        Array.from({ length: suggestionCount }, (_, index) =>
          provider.scene(input, { index, count: suggestionCount }, signal),
        ),
      )
      const results = settled.flatMap((entry) =>
        entry.status === 'fulfilled' ? [entry.value] : [],
      )
      if (results.length === 0) {
        const failed = settled.find((entry) => entry.status === 'rejected')
        throw failed?.status === 'rejected' ? failed.reason : new Error('no suggestion')
      }
      const suggestions = results
        .filter((result) => result.value.states.every((state) => isSafeScene(state.svg)))
        .map((result) => ({
          id: crypto.randomUUID(),
          alt: result.value.alt,
          states: result.value.states,
        }))
      if (suggestions.length === 0) {
        throw new AiProviderError('rejected', results[0]?.model ?? 'unknown')
      }
      return { answer: { suggestions }, results }
    }
    case 'icons': {
      const result = await provider.icons(body.concept, signal)
      const icons = result.value.filter(isSafeIcon)
      if (icons.length === 0) throw new AiProviderError('rejected', result.model)
      return { answer: { icons }, results: [result] }
    }
  }
}

/** A provider failure → what the Studio sees, and how the attempt is recorded. */
function failureOf(error: AiProviderError, action: GenerationBody['action']) {
  switch (error.kind) {
    case 'blocked':
      return { status: 'blocked' as const, failure: failures.validation(MESSAGES.filter) }
    case 'rejected':
      return {
        status: 'blocked' as const,
        failure: failures.validation(
          action === 'icons' ? MESSAGES.iconRejected : MESSAGES.sceneRejected,
        ),
      }
    case 'timeout':
      return { status: 'error' as const, failure: failures.unavailable(MESSAGES.timeout) }
    case 'quota':
      return { status: 'error' as const, failure: failures.quota(MESSAGES.providerQuota) }
    case 'rate':
      return { status: 'error' as const, failure: failures.rateLimited(MESSAGES.providerBusy) }
    case 'invalid':
      return { status: 'error' as const, failure: failures.unavailable(MESSAGES.invalid) }
    default:
      return { status: 'error' as const, failure: failures.unavailable() }
  }
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

async function generate(context: Context, body: GenerationBody) {
  const name = resolveProvider(Deno.env.get('AI_PROVIDER'), context.quota.provider)
  if (name === 'off') throw failures.notFound(MESSAGES.off)
  const pii = findPii(promptText(body))
  if (pii.length > 0) throw new DetailedFailure(failures.validation(MESSAGES.pii), { pii })
  const { quota } = context
  if (quota.userUsed >= quota.userLimit || quota.projectUsed >= quota.projectLimit) {
    throw new DetailedFailure(failures.quota(MESSAGES.quota), { resetsAt: quota.resetsAt })
  }
  const provider = providerFor(name)
  const kind = USAGE_KIND[body.action]
  const signal = AbortSignal.any([context.signal, AbortSignal.timeout(GEMINI_TIMEOUT_MS)])
  try {
    const { answer, results } = await run(provider, body, quota.suggestionCount, signal)
    await recordUsage(context, {
      kind,
      status: 'ok',
      provider: name,
      model: results[0]?.model ?? 'unknown',
      inputTokens: tokens(results, 'inputTokens'),
      outputTokens: tokens(results, 'outputTokens'),
    })
    return answer
  } catch (error) {
    const known = error instanceof AiProviderError ? failureOf(error, body.action) : null
    await recordUsage(context, {
      kind,
      status: known?.status ?? 'error',
      provider: name,
      model: error instanceof AiProviderError ? error.model : 'unknown',
      inputTokens: null,
      outputTokens: null,
    })
    throw known?.failure ?? error
  }
}

/** Uploads SVGs to the media bucket; on any failure the uploaded ones are removed again. */
async function uploadSvgs(admin: SupabaseClient, files: { path: string; svg: string }[]) {
  const bucket = admin.storage.from('media')
  const settled = await Promise.all(
    files.map(async ({ path, svg: markup }) => {
      const { error } = await bucket
        .upload(path, new Blob([markup], { type: 'image/svg+xml' }), {
          contentType: 'image/svg+xml',
          // Every drawing has its own path: the file never changes.
          cacheControl: '31536000',
          upsert: false,
        })
        .catch((thrown: unknown) => ({ error: thrown }))
      return { path, ok: !error }
    }),
  )
  const uploaded = settled.filter((entry) => entry.ok).map((entry) => entry.path)
  const undo = async () => {
    if (uploaded.length > 0) await bucket.remove(uploaded)
  }
  if (uploaded.length < files.length) {
    await undo()
    throw failures.unavailable()
  }
  return undo
}

function byteLength(markup: string) {
  return new TextEncoder().encode(markup).length
}

async function saveScene(
  context: Context,
  suggestion: Extract<Body, { action: 'save-scene' }>['suggestion'],
) {
  if (!suggestion.states.every((state) => isSafeScene(state.svg))) {
    throw failures.validation(MESSAGES.sceneUnsafe)
  }
  const sceneGroup = crypto.randomUUID()
  const alt = (suggestion.alt.trim() || svgDescription(suggestion.states[0]?.svg ?? '')).slice(
    0,
    240,
  )
  const rows = suggestion.states.map(({ state, svg: markup }) => ({
    id: crypto.randomUUID(),
    kind: 'ai-scene',
    name: `${alt} (${state})`.slice(0, 120),
    mime: 'image/svg+xml',
    bytes: byteLength(markup),
    width: 400,
    height: 260,
    alt: svgDescription(markup).slice(0, 240),
    path: `ai/${sceneGroup}/${state}.svg`,
    source: 'ai',
    scene_group: sceneGroup,
    scene_state: state,
    created_by: context.userId,
  }))
  const undo = await uploadSvgs(
    context.admin,
    rows.map((row, index) => ({ path: row.path, svg: suggestion.states[index]?.svg ?? '' })),
  )
  const inserted = await context.admin.from('media_assets').insert(rows)
  if (inserted.error) {
    await undo()
    throw failures.unavailable()
  }
  const audited = await context.admin.from('audit_log').insert({
    actor_id: context.userId,
    action: 'ai.scene_saved',
    entity: 'media',
    entity_id: sceneGroup,
    meta: { states: rows.length },
  })
  if (audited.error) console.error(`audit_log insert failed: ${audited.error.code ?? ''}`)
  return {
    kind: 'ai-scene',
    alt,
    states: rows.map((row) => ({ state: row.scene_state, media: { assetId: row.id } })),
  }
}

async function saveIcon(context: Context, markup: string, concept: string) {
  if (!isSafeIcon(markup)) throw failures.validation(MESSAGES.iconUnsafe)
  const id = crypto.randomUUID()
  const path = `ai/icons/${id}.svg`
  const undo = await uploadSvgs(context.admin, [{ path, svg: markup }])
  const { data, error } = await context.admin
    .from('media_assets')
    .insert({
      id,
      kind: 'ai-icon',
      name: `${concept.trim() || 'Yapay zekâ'} ikonu`.slice(0, 120),
      mime: 'image/svg+xml',
      bytes: byteLength(markup),
      width: 64,
      height: 64,
      alt: svgDescription(markup).slice(0, 240),
      path,
      source: 'ai',
      created_by: context.userId,
    })
    .select(MEDIA_COLUMNS)
    .single()
  if (error) {
    await undo()
    throw failures.unavailable()
  }
  return data
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

Deno.serve(async (request) => {
  const origin = allowedOrigin(request.headers.get('origin'), Deno.env.get('ALLOWED_ORIGIN'))
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) })
  try {
    if (request.method !== 'POST') throw failures.validation()
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) throw failures.unauthorized()

    const url = env('SUPABASE_URL')
    const caller = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: NO_SESSION,
    })
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: NO_SESSION })

    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw failures.validation()

    // Active staff only (ai_quota raises for devices, inactive staff, admins without TOTP);
    // the auth server names the caller for the usage and media rows.
    const [quota, user] = await Promise.all([
      rpc(caller, 'ai_quota'),
      admin.auth.getUser(authorization.slice('Bearer '.length)),
    ])
    if (user.error || !user.data.user) throw failures.unauthorized()
    const context: Context = {
      admin,
      userId: user.data.user.id,
      quota: quotaSchema.parse(quota),
      signal: request.signal,
    }

    switch (body.data.action) {
      case 'save-scene':
        return json(await saveScene(context, body.data.suggestion), 200, origin)
      case 'save-icon':
        return json(await saveIcon(context, body.data.svg, body.data.concept), 200, origin)
      default:
        return json(await generate(context, body.data), 200, origin)
    }
  } catch (error) {
    return answerError(error, origin)
  }
})
