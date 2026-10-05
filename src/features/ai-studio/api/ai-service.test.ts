import { checkPageHtml, type Step } from '@/entities/kit'
import { isAppError } from '@/shared/api/errors'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { aiService, FAKE_TRIGGERS } from '../index'

const scene = (prompt: string) => ({
  title: 'Tohum',
  answer: 'Tohum çimlenir.',
  blockType: 'tap-reveal' as const,
  states: ['before', 'after', 'static'],
  prompt,
})

const page = (prompt: string, title = 'Sayfa') => ({ prompt, title, ageMin: 7, ageMax: 11 })

/** Option labels of the question cards, in the order a child sees them. */
function optionLabels(steps: readonly Step[]) {
  return steps.flatMap((step) =>
    step.type === 'quiz' || step.type === 'choose-correct'
      ? step.options.map((option) => option.label)
      : [],
  )
}

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!isAppError(error)) throw new Error(`expected an AppError, got ${String(error)}`)
  return error
}

describe('AI service (fake provider, ADR 0018)', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
    signInAs('editor')
  })

  it('reports the daily quota of the signed-in user', async () => {
    const quota = await aiService.quota()

    expect(quota).toMatchObject({ provider: 'fake', userUsed: 0, userLimit: 20, projectLimit: 200 })
    expect(Date.parse(quota.resetsAt)).toBeGreaterThan(Date.now())
  })

  it('draws scene suggestions with one safe SVG per state and saves the chosen one', async () => {
    const stages: string[] = []
    const suggestions = await aiService.generateScene(scene('Filizlenen tohum'), {
      onProgress: (progress) => stages.push(progress.stage),
    })

    expect(suggestions.length).toBeGreaterThan(0)
    const [first] = suggestions
    expect(first?.states.map((state) => state.state)).toEqual(['before', 'after', 'static'])
    expect(first?.states.every((state) => state.svg.startsWith('<svg'))).toBe(true)
    expect(stages.at(-1)).toBe('done')

    const visual = await aiService.saveScene(first!)
    expect(visual.kind).toBe('ai-scene')
    expect((await aiService.quota()).userUsed).toBeGreaterThan(0)
  })

  it('refuses prompts with personal data', async () => {
    expect(
      (await failure(aiService.generateScene(scene('Bana ayse@ornek.com adresinden yaz')))).code,
    ).toBe('validation')
    expect((await failure(aiService.generateIcons('telefonum 0532 123 45 67'))).code).toBe(
      'validation',
    )
  })

  it('surfaces the provider’s safety filter and time-outs', async () => {
    expect(
      (await failure(aiService.generateScene(scene(`deney ${FAKE_TRIGGERS.filter}`)))).code,
    ).toBe('validation')
    expect(
      (await failure(aiService.generateScene(scene(`deney ${FAKE_TRIGGERS.timeout}`)))).code,
    ).toBe('unavailable')
  })

  it('never lets a malicious SVG through', async () => {
    expect(
      (await failure(aiService.generateScene(scene(`sahne ${FAKE_TRIGGERS.malicious}`)))).code,
    ).toBe('validation')
    const script = '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'
    expect((await failure(aiService.saveIcon(script, 'x'))).code).toBe('validation')
  })

  it('drafts card text and a whole kit', async () => {
    const text = await aiService.draftCardText({
      topic: 'Mıknatıs',
      blockType: 'quiz',
      title: 'Mıknatıs neyi çeker?',
      ageMin: 6,
      ageMax: 10,
    })
    expect(text.title).not.toBe('')
    expect(text.options.length).toBeGreaterThan(0)

    const kit = await aiService.draftKit({
      topic: 'Su döngüsü',
      ageMin: 7,
      ageMax: 11,
      cardCount: 5,
    })
    expect(kit.steps).toHaveLength(5)
    expect(kit.steps.every((step) => step.aiGenerated)).toBe(true)
  })

  it('drafts question cards whose answers cannot be guessed from position, icon or color', async () => {
    const topics = ['Mıknatıs', 'Su döngüsü', 'Gezegenler', 'Işık', 'Ses', 'Volkanlar']
    const wrongChoicePositions = new Set<number>()
    const correctQuizPositions = new Set<number>()

    for (const topic of topics) {
      // oxlint-disable-next-line no-await-in-loop -- the mock backend handles one draft at a time
      const kit = await aiService.draftKit({ topic, ageMin: 7, ageMax: 11, cardCount: 4 })
      const choose = kit.steps.find((step) => step.type === 'choose-correct')
      const quiz = kit.steps.find((step) => step.type === 'quiz')
      if (choose?.type !== 'choose-correct' || quiz?.type !== 'quiz') throw new Error('no cards')

      expect(new Set(choose.options.map((option) => option.icon)).size).toBe(1)
      expect(new Set(choose.options.map((option) => option.color)).size).toBe(1)
      expect(choose.options.filter((option) => option.correct)).toHaveLength(2)
      wrongChoicePositions.add(choose.options.findIndex((option) => !option.correct))

      const correct = quiz.options.find((option) => option.id === quiz.correctOptionId)
      expect(correct?.label).toMatch(/bir bilim konusudur$/)
      correctQuizPositions.add(quiz.options.findIndex((option) => option.id === correct?.id))
    }

    expect(wrongChoicePositions.size).toBeGreaterThan(1)
    expect(correctQuizPositions.size).toBeGreaterThan(1)
  })

  it('shuffles the same topic the same way every time', async () => {
    const request = { topic: 'Mıknatıs', ageMin: 7, ageMax: 11, cardCount: 4 }
    const first = await aiService.draftKit(request)
    const second = await aiService.draftKit(request)

    expect(optionLabels(first.steps)).toEqual(optionLabels(second.steps))
  })

  it('drafts an interactive page that passes the page check and counts towards the quota', async () => {
    const stages: string[] = []
    const draft = await aiService.draftPage(page('Ay’ın Dünya çevresindeki turu', 'Dünya ve Ay'), {
      onProgress: (progress) => stages.push(progress.stage),
    })

    expect(draft.title).toBe('Dünya ve Ay')
    expect(draft.html).toMatch(/^<!doctype html>/)
    expect(draft.html).toContain('<title>Dünya ve Ay</title>')
    expect(checkPageHtml(draft.html)).toEqual([])
    expect(stages).toEqual(['queued', 'drawing', 'checking', 'done'])
    expect((await aiService.quota()).userUsed).toBe(1)
  })

  it('refuses page requests the other drafts refuse, and never lets a malicious page through', async () => {
    const pii = page('Bana ayse@ornek.com adresinden yaz')
    expect((await failure(aiService.draftPage(pii))).code).toBe('validation')
    const filtered = page(`deney ${FAKE_TRIGGERS.filter}`)
    expect((await failure(aiService.draftPage(filtered))).code).toBe('validation')
    const slow = page(`deney ${FAKE_TRIGGERS.timeout}`)
    expect((await failure(aiService.draftPage(slow))).code).toBe('unavailable')
    const malicious = await failure(aiService.draftPage(page(`sayfa ${FAKE_TRIGGERS.malicious}`)))
    expect(malicious.code).toBe('validation')
    expect(malicious.message).toMatch(/sayfa güvenlik kontrolünden geçemedi/)
    // Refused page attempts count — the provider was asked (20261005120000_ai_page_kind.sql). A
    // request with personal data never reached it and a timed-out one is an error: neither counts.
    expect((await aiService.quota()).userUsed).toBe(2)
  })

  it('generates icons and stores one in the media library', async () => {
    const icons = await aiService.generateIcons('roket')
    expect(icons.length).toBeGreaterThan(0)

    const asset = await aiService.saveIcon(icons[0]!, 'roket')
    expect(asset.kind).toBe('ai-icon')
  })

  it('stops at the daily per-user limit', async () => {
    await seedMockBackend({ ...MINIMAL_SEED, settings: { aiDailyUserLimit: 1 } })
    signInAs('editor')

    await aiService.generateIcons('yıldız')
    expect((await failure(aiService.generateIcons('ay'))).code).toBe('quota')
    expect((await failure(aiService.draftPage(page('Ay')))).code).toBe('quota')
  })

  it('is unavailable when the provider is switched off', async () => {
    await seedMockBackend({ ...MINIMAL_SEED, settings: { aiProvider: 'off' } })
    signInAs('editor')

    expect((await failure(aiService.generateIcons('güneş'))).code).toBe('not_found')
    expect((await failure(aiService.draftPage(page('Güneş')))).code).toBe('not_found')
    expect((await aiService.quota()).provider).toBe('off')
  })

  it('requires a staff session', async () => {
    sessionStorage.clear()

    expect((await failure(aiService.quota())).code).toBe('unauthorized')
  })
})
