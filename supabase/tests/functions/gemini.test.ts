import {
  AiProviderError,
  cardTextPrompt,
  createGeminiProvider,
  geminiRequest,
  iconPrompt,
  isWellFormedSvg,
  kitSchema,
  readCardText,
  readGeminiAnswer,
  readKit,
  readOptions,
  readScene,
  resolveProvider,
  scenePrompt,
  GEMINI_API,
  GEMINI_DEFAULT_LIGHT_MODEL,
  GEMINI_DEFAULT_MODEL,
  type KitInput,
} from '../../functions/_shared/gemini.ts'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><title>Tohum</title><desc>Toprakta bir tohum</desc><rect width="400" height="260" fill="#BDE9FF"/></svg>'

const KIT: KitInput = {
  topic: 'Su döngüsü',
  ageMin: 7,
  ageMax: 11,
  categories: ['water', 'other'],
  cards: [
    { blockType: 'info', blockLabel: 'Bilgi kartı', blockDescription: 'Kısa açıklama.' },
    { blockType: 'quiz', blockLabel: 'Soru', blockDescription: 'Tek doğru cevap.' },
  ],
}

const CARD = {
  title: 'Su neden buharlaşır?',
  answer: 'Güneş suyu **ısıtır**.',
  narration: 'Güneş suyu ısıtır.',
  hint: '👆 Dokun!',
  celebration: '🎉 Harika!',
  options: [],
  correctCount: 0,
}

/** A generateContent answer whose text is `value` as JSON. */
function answer(value: unknown, extra: Record<string, unknown> = {}) {
  return {
    candidates: [
      { content: { parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP', ...extra },
    ],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 2 },
  }
}

type Call = { url: string; headers: Headers; body: Record<string, unknown> }

/** A fetch that answers from a queue and records every request. */
function fakeFetch(...responses: (() => Response)[]) {
  const calls: Call[] = []
  const send: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    })
    const next = responses.shift()
    if (!next) throw new Error('unexpected request')
    return next()
  }
  return { calls, send }
}

/** A request that only ends when its signal aborts it. */
const neverAnswers: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })

const ok = (value: unknown) => () => Response.json(answer(value))
const status =
  (code: number, error: Record<string, unknown> = {}) =>
  () =>
    Response.json({ error: { code, ...error } }, { status: code })

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!(error instanceof AiProviderError)) throw new Error(`expected an AiProviderError`)
  return error
}

const signal = new AbortController().signal

describe('provider choice', () => {
  it('runs Gemini only when both the secret and the setting say so', () => {
    expect(resolveProvider('gemini', 'gemini')).toBe('gemini')
    expect(resolveProvider('gemini', 'fake')).toBe('fake')
    expect(resolveProvider('fake', 'gemini')).toBe('fake')
    expect(resolveProvider('gemini', 'off')).toBe('off')
    expect(resolveProvider('off', 'gemini')).toBe('off')
    expect(resolveProvider(undefined, 'gemini')).toBe('off')
    expect(resolveProvider('GEMINI', 'gemini')).toBe('off')
  })
})

describe('Gemini prompts', () => {
  it('spell out the SVG contract of checkAiSvg', () => {
    const scene = scenePrompt(
      {
        title: 'Tohum',
        answer: 'Çimlenir',
        prompt: 'tohum',
        blockLabel: 'Dokun',
        states: ['before', 'static'],
      },
      { index: 1, count: 2 },
    )
    expect(scene).toContain('viewBox="0 0 400 260"')
    expect(scene).toContain('12 000 bayt')
    expect(scene).toMatch(/<title>.*<desc>/s)
    expect(scene).toMatch(/script, style, foreignObject/)
    expect(scene).toContain('- static: durağan kare')
    expect(scene).toContain('2 önerisinden 2. öneridir')

    const icon = iconPrompt('roket')
    expect(icon).toContain('viewBox="0 0 64 64"')
    expect(icon).toContain('4 000 bayt')
  })

  it('give every block type its option rule and the schema limits', () => {
    const quiz = cardTextPrompt({
      topic: 'Mıknatıs',
      title: '',
      blockType: 'quiz',
      blockLabel: 'Soru',
      blockDescription: 'Tek doğru cevap.',
      ageMin: 6,
      ageMax: 10,
    })
    expect(quiz).toContain('6–10 yaş')
    expect(quiz).toContain('İLK seçenek tek doğru cevaptır')
    expect(quiz).toContain('en çok 240 karakter')
    expect(quiz).toContain('“Mıknatıs”')
    expect(JSON.stringify(kitSchema(KIT))).toContain('"minItems":2,"maxItems":2')
  })

  it('ask for JSON with a schema and keep thinking short', () => {
    const flash = geminiRequest('gemini-2.5-flash', 'x', { type: 'OBJECT' })
    expect(flash.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
      thinkingConfig: { thinkingBudget: 0 },
    })
    expect(geminiRequest('gemini-3.1-flash-lite', 'x', {}).generationConfig).toMatchObject({
      thinkingConfig: { thinkingLevel: 'low' },
    })
    expect(geminiRequest('gemini-exp', 'x', {}).generationConfig).not.toHaveProperty(
      'thinkingConfig',
    )
  })
})

describe('reading Gemini answers', () => {
  it('returns the text and token counts, or why there is none', () => {
    expect(readGeminiAnswer(answer({ a: 1 }))).toEqual({
      kind: 'text',
      text: '{"a":1}',
      inputTokens: 120,
      outputTokens: 42,
    })
    expect(readGeminiAnswer({ promptFeedback: { blockReason: 'SAFETY' } })).toEqual({
      kind: 'blocked',
    })
    expect(readGeminiAnswer(answer({}, { finishReason: 'PROHIBITED_CONTENT' })).kind).toBe(
      'blocked',
    )
    expect(readGeminiAnswer(answer({}, { finishReason: 'MAX_TOKENS' })).kind).toBe('invalid')
    expect(readGeminiAnswer({ candidates: [] }).kind).toBe('invalid')
  })

  it('keeps choice options correct-first and within the block limits', () => {
    expect(readOptions('quiz', ['Doğru', 'Yanlış', 'doğru', 'Başka', 'Fazla'], 3)).toEqual({
      options: ['Doğru', 'Yanlış', 'Başka', 'Fazla'],
      correctCount: 1,
    })
    expect(readOptions('choose-correct', ['Su', 'Işık', 'Taş'], 2)).toEqual({
      options: ['Su', 'Işık', 'Taş'],
      correctCount: 2,
    })
    // All correct (or none) is no question.
    expect(readOptions('choose-correct', ['Su', 'Işık'], 2)).toBeNull()
    expect(readOptions('choose-correct', ['Çok uzun bir seçenek etiketi burada'], 1)).toBeNull()
    expect(readOptions('sequence', ['Ek', 'Sula'], 2)).toBeNull()
    expect(readOptions('matching', ['Göz', 'Görme', 'Kulak', 'Duyma', 'El'], 2)).toEqual({
      options: ['Göz', 'Görme', 'Kulak', 'Duyma'],
      correctCount: 2,
    })
    expect(readOptions('compare-cards', ['Gündüz', 'Gece', 'Akşam'], 0)).toEqual({
      options: ['Gündüz', 'Gece'],
      correctCount: 0,
    })
    expect(readOptions('info', ['x'], 1)).toEqual({ options: [], correctCount: 0 })
  })

  it('clamps card texts to the schema limits and fills what is missing', () => {
    const draft = readCardText(
      { ...CARD, title: 'T'.repeat(90), answer: `**${'a'.repeat(300)}**`, narration: '' },
      'info',
    )
    expect(draft?.title).toHaveLength(80)
    expect(draft?.answer).toBe('a'.repeat(238))
    expect(draft?.narration).toBe('a'.repeat(238))
    expect(readCardText({ ...CARD, answer: '' }, 'info')).toBeNull()
    expect(readCardText({ ...CARD, options: ['Tek'] }, 'quiz')).toBeNull()
  })

  it('reads a kit with one card per block type', () => {
    const kit = {
      kit: {
        title: 'Su döngüsü',
        tagline: 'Damlanın yolculuğu',
        description: 'Keşfet.',
        category: 'weather',
        learningObjectives: ['Gözlemler.'],
        badgeName: '',
      },
      cards: [CARD, { ...CARD, options: ['Tek'] }],
    }
    const read = readKit(kit, KIT)
    expect(read?.kit).toMatchObject({ category: 'other', badgeName: 'Su döngüsü Kâşifi' })
    // Unusable options leave a kit card without options instead of failing the kit.
    expect(read?.cards[1]).toMatchObject({ options: [], correctCount: 0 })
    expect(readKit({ ...kit, cards: [CARD] }, KIT)).toBeNull()
  })

  it('reads one SVG per requested state, in the requested order', () => {
    const value = {
      alt: 'Tohum',
      states: [
        { state: 'static', svg: SVG },
        { state: 'before', svg: ` ${SVG} ` },
      ],
    }
    expect(readScene(value, ['before', 'static'])?.states).toEqual([
      { state: 'before', svg: SVG },
      { state: 'static', svg: SVG },
    ])
    expect(readScene(value, ['before', 'after', 'static'])).toBeNull()
  })

  it('tells well-formed SVG from broken markup', () => {
    expect(isWellFormedSvg(SVG)).toBe(true)
    expect(isWellFormedSvg(SVG.replace('<rect', '<!-- a > b --><rect'))).toBe(true)
    expect(isWellFormedSvg(SVG.replace('</title>', ''))).toBe(false)
    expect(isWellFormedSvg(SVG.replace('Tohum</title>', 'Su & hava</title>'))).toBe(false)
    expect(isWellFormedSvg(SVG.replace('width="400"', 'width=400'))).toBe(false)
    expect(isWellFormedSvg(`${SVG}<svg></svg>`)).toBe(false)
  })
})

describe('Gemini client', () => {
  const card = {
    topic: 'Su',
    title: '',
    blockType: 'info',
    blockLabel: 'Bilgi kartı',
    blockDescription: '',
    ageMin: 6,
    ageMax: 10,
  }

  it('calls generateContent with the key header and reads the JSON answer', async () => {
    const { calls, send } = fakeFetch(ok(CARD))
    const gemini = createGeminiProvider({ apiKey: 'test-key', fetch: send })

    const result = await gemini.cardText(card, signal)

    expect(result).toMatchObject({ value: CARD, model: GEMINI_DEFAULT_MODEL, inputTokens: 120 })
    expect(calls[0]?.url).toBe(`${GEMINI_API}/${GEMINI_DEFAULT_MODEL}:generateContent`)
    expect(calls[0]?.headers.get('x-goog-api-key')).toBe('test-key')
    expect(calls[0]?.body).toHaveProperty('systemInstruction')
  })

  it('falls back to the light model when the main one is rate-limited or overloaded', async () => {
    const { calls, send } = fakeFetch(status(429), ok(CARD))
    const gemini = createGeminiProvider({
      apiKey: 'k',
      model: 'models/gemini-x-flash',
      lightModel: 'gemini-x-lite',
      fetch: send,
    })

    expect((await gemini.cardText(card, signal)).model).toBe('gemini-x-lite')
    expect(calls.map((call) => call.url.split('/').at(-1))).toEqual([
      'gemini-x-flash:generateContent',
      'gemini-x-lite:generateContent',
    ])

    const overloaded = fakeFetch(status(503), status(503))
    const busy = createGeminiProvider({ apiKey: 'k', fetch: overloaded.send })
    expect((await failure(busy.cardText(card, signal))).kind).toBe('unavailable')
  })

  it('reports an exhausted free quota, or a per-minute limit', async () => {
    const daily = fakeFetch(status(429), status(429))
    expect(
      (
        await failure(
          createGeminiProvider({ apiKey: 'k', fetch: daily.send }).cardText(card, signal),
        )
      ).kind,
    ).toBe('quota')

    const perMinute = () =>
      status(429, {
        status: 'RESOURCE_EXHAUSTED',
        details: [
          { violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
        ],
      })()
    const minute = fakeFetch(perMinute, perMinute)
    const error = await failure(
      createGeminiProvider({ apiKey: 'k', fetch: minute.send }).cardText(card, signal),
    )
    expect(error).toMatchObject({ kind: 'rate', model: GEMINI_DEFAULT_LIGHT_MODEL })
  })

  it('surfaces safety blocks without trying another model', async () => {
    const { calls, send } = fakeFetch(() =>
      Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    )
    const error = await failure(
      createGeminiProvider({ apiKey: 'k', fetch: send }).cardText(card, signal),
    )
    expect(error.kind).toBe('blocked')
    expect(calls).toHaveLength(1)
  })

  it('retries once without the thinking setting when a model refuses it', async () => {
    const { calls, send } = fakeFetch(status(400), ok(CARD))
    await createGeminiProvider({ apiKey: 'k', fetch: send }).cardText(card, signal)

    expect(calls[0]?.body['generationConfig']).toHaveProperty('thinkingConfig')
    expect(calls[1]?.body['generationConfig']).not.toHaveProperty('thinkingConfig')
  })

  it('rejects answers it cannot use', async () => {
    const broken = fakeFetch(() =>
      Response.json({
        candidates: [{ content: { parts: [{ text: '{"title":' }] }, finishReason: 'STOP' }],
      }),
    )
    expect(
      (
        await failure(
          createGeminiProvider({ apiKey: 'k', fetch: broken.send }).cardText(card, signal),
        )
      ).kind,
    ).toBe('invalid')

    const partial = fakeFetch(ok({ alt: 'x', states: [{ state: 'before', svg: SVG }] }))
    const scene = createGeminiProvider({ apiKey: 'k', fetch: partial.send }).scene(
      {
        title: 'Tohum',
        answer: '',
        prompt: 'tohum',
        blockLabel: 'Dokun',
        states: ['before', 'static'],
      },
      { index: 0, count: 1 },
      signal,
    )
    expect((await failure(scene)).kind).toBe('invalid')
  })

  it('stops at the time-out', async () => {
    const error = await failure(
      createGeminiProvider({ apiKey: 'k', fetch: neverAnswers }).icons(
        'roket',
        AbortSignal.timeout(5),
      ),
    )
    expect(error.kind).toBe('timeout')
  })
})
