import { delay, http, HttpResponse } from 'msw'

import { kitDocumentSchema, type Step } from '@/entities/kit'
import { isAppError } from '@/shared/api/errors'
import { server } from '@/test/mocks/server'
import {
  edgeFunction,
  edgeFunctionError,
  resetSupabase,
  rpc,
  rpcError,
  signedInStaff,
  SUPABASE_URL,
} from '@/test/supabase'

import { createSupabaseAiService } from './ai.supabase'
import { KIT_BLOCK_ROTATION } from './compose'
import { fakeCardText, fakeIconSvg, fakeSceneSvg, maliciousSvg } from './fake-provider'
import type { AiProgress, SceneSuggestion } from './port'

const ai = createSupabaseAiService()

const USER_ID = '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-generate`

const QUOTA = {
  provider: 'gemini',
  userUsed: 3,
  userLimit: 20,
  projectUsed: 40,
  projectLimit: 200,
  suggestionCount: 1,
  resetsAt: '2026-09-25T21:00:00.000Z',
}

const SCENE_REQUEST = {
  title: 'Tohum',
  answer: 'Tohum çimlenir.',
  blockType: 'tap-reveal' as const,
  states: ['before', 'after', 'static'],
  prompt: 'Filizlenen tohum',
}

function suggestion(draw: (state: string) => string = sceneSvg): SceneSuggestion {
  return {
    id: crypto.randomUUID(),
    alt: 'Tohum: yapay zekâ ile çizilmiş sahne',
    states: SCENE_REQUEST.states.map((state) => ({ state, svg: draw(state) })),
  }
}

function sceneSvg(state: string) {
  return fakeSceneSvg({ title: 'Tohum', topic: 'tohum', state })
}

function stagesOf() {
  const stages: AiProgress['stage'][] = []
  return { stages, onProgress: (progress: AiProgress) => stages.push(progress.stage) }
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

beforeEach(() => signedInStaff(USER_ID))
afterEach(resetSupabase)

describe('Supabase AI service: quota', () => {
  it('reads the daily quota with the ai_quota RPC', async () => {
    const calls = rpc('ai_quota', () => QUOTA)

    expect(await ai.quota()).toEqual(QUOTA)
    expect(calls).toEqual([{}])
  })

  it('passes the refusal of a caller who is not active staff on', async () => {
    rpcError('ai_quota', 'KS401', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.')

    expect(isAppError(await failure(ai.quota()), 'unauthorized')).toBe(true)
  })
})

describe('Supabase AI service: drawings', () => {
  it('draws scenes through ai-generate and reports progress up to done', async () => {
    const bodies = edgeFunction('ai-generate', () => ({ suggestions: [suggestion()] }))
    const progress = stagesOf()

    const suggestions = await ai.generateScene(SCENE_REQUEST, progress)

    expect(bodies).toEqual([{ action: 'scene', ...SCENE_REQUEST }])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.states.map((entry) => entry.state)).toEqual(SCENE_REQUEST.states)
    expect(progress.stages).toEqual(['queued', 'drawing', 'checking', 'done'])
  })

  it('drops drawings that fail the SVG check and refuses when none is left', async () => {
    edgeFunction('ai-generate', () => ({
      suggestions: [suggestion(() => maliciousSvg('Tohum')), suggestion()],
    }))
    expect(await ai.generateScene(SCENE_REQUEST)).toHaveLength(1)

    edgeFunction('ai-generate', () => ({ suggestions: [suggestion(() => maliciousSvg('x'))] }))
    const error = await failure(ai.generateScene(SCENE_REQUEST))
    expect(isAppError(error, 'validation') && error.message).toMatch(/güvenlik kontrolünden/)
  })

  it('saves the chosen scene through the function and returns its visual', async () => {
    const visual = {
      kind: 'ai-scene',
      alt: 'Tohum: yapay zekâ ile çizilmiş sahne',
      states: SCENE_REQUEST.states.map((state) => ({
        state,
        media: { assetId: crypto.randomUUID() },
      })),
    }
    const bodies = edgeFunction('ai-generate', () => visual)
    const chosen = suggestion()

    expect(await ai.saveScene(chosen)).toEqual(visual)
    expect(bodies).toEqual([{ action: 'save-scene', suggestion: chosen }])
  })

  it('never sends an unsafe drawing to be saved', async () => {
    const bodies = edgeFunction('ai-generate', () => ({}))

    expect(
      isAppError(await failure(ai.saveScene(suggestion(() => maliciousSvg('x')))), 'validation'),
    ).toBe(true)
    const script = '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'
    expect(isAppError(await failure(ai.saveIcon(script, 'x')), 'validation')).toBe(true)
    expect(bodies).toEqual([])
  })

  it('generates icons and keeps only safe ones', async () => {
    const bodies = edgeFunction('ai-generate', () => ({
      icons: [fakeIconSvg('roket', 0), maliciousSvg('roket')],
    }))

    expect(await ai.generateIcons('roket')).toEqual([fakeIconSvg('roket', 0)])
    expect(bodies).toEqual([{ action: 'icons', concept: 'roket' }])
  })

  it('saves an icon and links the stored file by its public URL', async () => {
    const id = crypto.randomUUID()
    const svg = fakeIconSvg('roket', 1)
    const bodies = edgeFunction('ai-generate', () => ({
      id,
      kind: 'ai-icon',
      name: 'roket ikonu',
      mime: 'image/svg+xml',
      bytes: 420,
      width: 64,
      height: 64,
      durationSec: null,
      alt: 'roket ikonu',
      path: `icons/${id}.svg`,
      source: 'ai',
      sceneGroup: null,
      sceneState: null,
      createdBy: USER_ID,
      createdAt: '2026-09-25T10:00:00.123456+00:00',
    }))

    const asset = await ai.saveIcon(svg, 'roket')

    expect(bodies).toEqual([{ action: 'save-icon', svg, concept: 'roket' }])
    expect(asset).toMatchObject({ id, kind: 'ai-icon', source: 'ai' })
    expect(asset.url).toBe(`${SUPABASE_URL}/storage/v1/object/public/ai/icons/${id}.svg`)
    expect(asset).not.toHaveProperty('path')
  })
})

describe('Supabase AI service: texts', () => {
  it('drafts card text', async () => {
    const draft = fakeCardText('Mıknatıs', 'quiz')
    const bodies = edgeFunction('ai-generate', () => draft)
    const progress = stagesOf()
    const request = {
      topic: 'Mıknatıs',
      blockType: 'quiz' as const,
      title: 'Mıknatıs neyi çeker?',
      ageMin: 6,
      ageMax: 10,
    }

    expect(await ai.draftCardText(request, progress)).toEqual(draft)
    expect(bodies).toEqual([{ action: 'card-text', ...request }])
    expect(progress.stages).toEqual(['queued', 'drawing', 'done'])
  })

  it('drafts a kit from one card text per block type, composed like the mock', async () => {
    const bodies = edgeFunction('ai-generate', (body) => ({
      kit: {
        title: 'Su döngüsü',
        tagline: 'Damlanın gökyüzü yolculuğu',
        description: 'Suyun **buharlaşıp** yağmur olarak geri dönüşünü keşfet.',
        category: 'water',
        learningObjectives: ['Suyun hâl değişimlerini gözlemler.'],
        badgeName: 'Su Döngüsü Kâşifi',
      },
      cards: (body['blockTypes'] as string[]).map((type) => fakeCardText('Su döngüsü', type)),
    }))

    const kit = await ai.draftKit({ topic: 'Su döngüsü', ageMin: 7, ageMax: 11, cardCount: 5 })

    expect(bodies).toEqual([
      {
        action: 'kit',
        topic: 'Su döngüsü',
        ageMin: 7,
        ageMax: 11,
        blockTypes: KIT_BLOCK_ROTATION.slice(0, 5),
      },
    ])
    expect(kit).toMatchObject({ title: 'Su döngüsü', category: 'water', qrSequence: 5 })
    expect(kit.steps.map((step: Step) => step.type)).toEqual(KIT_BLOCK_ROTATION.slice(0, 5))
    expect(kit.steps.every((step) => step.aiGenerated)).toBe(true)
    expect(new Set(kit.steps.map((step) => step.title)).size).toBe(5)
    const quiz = kit.steps.find((step) => step.type === 'quiz')
    if (quiz?.type !== 'quiz') throw new Error('no quiz card')
    const correct = quiz.options.find((option) => option.id === quiz.correctOptionId)
    expect(correct?.label).toMatch(/bir bilim konusudur$/)
    const document = { ...kit, id: crypto.randomUUID(), slug: 'su-dongusu', qrPrefix: 'XX' }
    expect(kitDocumentSchema.safeParse(document).success).toBe(true)
  })

  it('refuses a kit draft that lacks cards', async () => {
    edgeFunction('ai-generate', () => ({
      kit: {
        title: 'Işık',
        tagline: '',
        description: '',
        category: 'other',
        learningObjectives: [],
        badgeName: '',
      },
      cards: [fakeCardText('Işık', 'info')],
    }))

    expect(
      await failure(ai.draftKit({ topic: 'Işık', ageMin: 7, ageMax: 11, cardCount: 4 })),
    ).toBeInstanceOf(Error)
  })
})

describe('Supabase AI service: failures', () => {
  it('turns the function’s refusals into AppErrors with their message and details', async () => {
    edgeFunctionError(
      'ai-generate',
      429,
      'KS430',
      'Bugünkü ücretsiz yapay zekâ kotası doldu. Kota gece 00:00’da (İstanbul) yenilenir.',
      { resetsAt: QUOTA.resetsAt },
    )
    const quota = await failure(ai.generateIcons('ay'))
    expect(isAppError(quota, 'quota') && quota.details['resetsAt']).toBe(QUOTA.resetsAt)

    const pii = 'İstemde kişisel veri (e-posta, telefon ya da kimlik no) var. Lütfen çıkarın.'
    edgeFunctionError('ai-generate', 422, 'KS422', pii)
    const validation = await failure(ai.generateScene(SCENE_REQUEST))
    expect(isAppError(validation, 'validation') && validation.message).toBe(pii)

    edgeFunctionError('ai-generate', 404, 'KS404', 'Yapay zekâ bu kurulumda kapalı.')
    expect(isAppError(await failure(ai.generateIcons('güneş')), 'not_found')).toBe(true)
  })

  it('keeps the function’s own text for time-outs and unusable answers', async () => {
    const timeout = 'Yapay zekâ 120 saniye içinde yanıt vermedi. Tekrar deneyin.'
    edgeFunctionError('ai-generate', 503, 'KS500', timeout)

    const error = await failure(
      ai.draftCardText({ topic: 'Işık', blockType: 'info', title: 'Işık', ageMin: 6, ageMax: 10 }),
    )
    expect(isAppError(error, 'unavailable') && error.message).toBe(timeout)
  })

  it('reports a failed connection as a network error', async () => {
    server.use(http.post(FUNCTION_URL, () => HttpResponse.error()))

    expect(isAppError(await failure(ai.generateIcons('ay')), 'network')).toBe(true)
  })

  it('cancels a running generation with an AbortError, like the mock', async () => {
    server.use(
      http.post(FUNCTION_URL, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const controller = new AbortController()

    const error = await failure(
      ai.generateIcons('roket', {
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.stage === 'drawing') controller.abort()
        },
      }),
    )

    expect(error).toMatchObject({ name: 'AbortError' })
  })
})
