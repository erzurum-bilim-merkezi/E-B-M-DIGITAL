import { BLOK_VITRINI, type BlockType, type Step, type StepOf } from '@/entities/kit'

import type { AiCardText } from '../../index'
import { applyAiText } from './apply-ai-text'

function isStepOf<T extends BlockType>(step: Step, type: T): step is StepOf<T> {
  return step.type === type
}

function sample<T extends BlockType>(type: T): StepOf<T> {
  const step = BLOK_VITRINI.steps.find(
    (candidate): candidate is StepOf<T> => candidate.type === type,
  )
  if (!step) throw new Error(`BLOK_VITRINI has no ${type} card`)
  return step
}

function draft(overrides: Partial<AiCardText> = {}): AiCardText {
  return {
    title: 'Bitki nerede beslenir?',
    answer: 'Yapraklarında besin üretir.',
    narration: 'Bitkiler yapraklarında besin üretir.',
    hint: '👆 Yaprağa dokun',
    celebration: '🌿 Harika!',
    options: ['Yaprak', 'Kök', 'Çiçek', 'Gövde', 'Tohum', 'Meyve', 'Dal'],
    correctCount: 2,
    ...overrides,
  }
}

function applied<T extends BlockType>(type: T, overrides: Partial<AiCardText> = {}) {
  const { step, fields } = applyAiText(sample(type), draft(overrides))
  if (!isStepOf(step, type)) throw new Error('applyAiText changed the block type')
  return { step, fields }
}

const TEXT_FIELDS = ['title', 'answer', 'narration', 'hint', 'celebration']

describe('applyAiText', () => {
  it('fills the common fields within their limits', () => {
    const { step, fields } = applied('tap-reveal', {
      title: 'B'.repeat(90),
      narration: 'N'.repeat(700),
      hint: 'H'.repeat(130),
      celebration: 'C'.repeat(50),
    })

    expect(step.title).toHaveLength(80)
    expect(step.narration).toHaveLength(600)
    expect(step.hint).toHaveLength(120)
    expect(step.celebration).toHaveLength(40)
    expect(step.answer).toBe('Yapraklarında besin üretir.')
    expect(step.tapLabel).toBe(sample('tap-reveal').tapLabel)
    expect(fields).toEqual(TEXT_FIELDS)
  })

  it('turns options into shuffled choices that look alike (nothing gives the answer away)', () => {
    const { step, fields } = applied('choose-correct')

    expect(step.options).toHaveLength(6)
    const correct = step.options.filter((option) => option.correct).map((option) => option.label)
    expect(correct.toSorted()).toEqual(['Kök', 'Yaprak'])
    expect(step.options.map((option) => option.label)).not.toEqual([
      'Yaprak',
      'Kök',
      'Çiçek',
      'Gövde',
      'Tohum',
      'Meyve',
    ])
    expect(new Set(step.options.map((option) => `${option.icon}|${option.color}`)).size).toBe(1)
    expect(step.options.every((option) => option.feedback === '')).toBe(true)
    expect(fields).toEqual([...TEXT_FIELDS, 'options'])
    // Stable per card: applying the same draft again gives the same order.
    expect(applied('choose-correct').step.options.map((option) => option.label)).toEqual(
      step.options.map((option) => option.label),
    )
  })

  it('makes a quiz whose answer (the first AI option) is shuffled among the choices', () => {
    const { step, fields } = applied('quiz')

    expect(step.question).toBe('Bitki nerede beslenir?')
    expect(step.options.map((option) => option.label).toSorted()).toEqual(
      ['Yaprak', 'Kök', 'Çiçek', 'Gövde'].toSorted(),
    )
    expect(step.options.map((option) => option.label)).not.toEqual([
      'Yaprak',
      'Kök',
      'Çiçek',
      'Gövde',
    ])
    expect(step.options.find((option) => option.id === step.correctOptionId)?.label).toBe('Yaprak')
    expect(fields).toContain('options')
  })

  it('keeps sequence steps in the solved order, up to eight', () => {
    const { step } = applied('sequence', {
      options: [
        'Merkür',
        'Venüs',
        'Dünya',
        'Mars',
        'Jüpiter',
        'Satürn',
        'Uranüs',
        'Neptün',
        'Plüton',
      ],
    })

    expect(step.items.map((item) => item.label)).toEqual([
      'Merkür',
      'Venüs',
      'Dünya',
      'Mars',
      'Jüpiter',
      'Satürn',
      'Uranüs',
      'Neptün',
    ])
    // Order-free placeholder icons (6 distinct, then they repeat) never hint at the order.
    expect(new Set(step.items.map((item) => item.icon)).size).toBe(6)
  })

  it('pairs consecutive options for matching and drops an odd one out', () => {
    const { step } = applied('matching', { options: ['Arı', 'Bal', 'İnek', 'Süt', 'Tavuk'] })

    expect(step.pairs.map((pair) => [pair.left, pair.right])).toEqual([
      ['Arı', 'Bal'],
      ['İnek', 'Süt'],
    ])
  })

  it('writes the answer into an info card body', () => {
    const { step, fields } = applied('info')

    expect(step.body).toBe('Yapraklarında besin üretir.')
    expect(fields).toEqual([...TEXT_FIELDS, 'body'])
  })

  it.each([
    ['choose-correct', ['Tek']],
    ['quiz', ['Tek']],
    ['sequence', ['Bir', 'İki']],
    ['matching', ['Arı', 'Bal', 'İnek']],
  ] as const)('keeps the %s items when the AI gives too few options', (type, options) => {
    const before = sample(type)

    const { step, fields } = applyAiText(before, draft({ options: [...options] }))

    expect(step).toEqual({ ...before, ...pickText(step) })
    expect(fields).toEqual(TEXT_FIELDS)
  })
})

function pickText(step: Step) {
  return {
    title: step.title,
    answer: step.answer,
    narration: step.narration,
    hint: step.hint,
    celebration: step.celebration,
  }
}
