/* oxlint-disable no-await-in-loop -- calls run one after another */
import { topicKitMeta } from '@/features/ai-studio/api/compose'
import * as app from '@/features/ai-studio/api/fake-provider'

import { AI_ICON_MAX_BYTES, checkAiSvg } from '../../functions/_shared/entities/kit/index.ts'
import {
  createFakeProvider,
  fakeCardText,
  fakeIconSvg,
  fakeKitMeta,
  fakeSceneSvg,
  FAKE_TRIGGERS,
  maliciousSvg,
  pickEmoji,
} from '../../functions/_shared/fake-ai.ts'
import { AiProviderError, isWellFormedSvg } from '../../functions/_shared/gemini.ts'

const TOPICS = ['Mıknatıs', 'su döngüsü', 'Gezegenler', 'IŞIK', '', 'Arı & bal <kovan>']
const BLOCKS = ['info', 'quiz', 'choose-correct', 'sequence', 'matching', 'compare-cards', 'video']
const STATES = ['before', 'after', 'on', 'off', 'idle', 'success', 'play', 'static', 'sun', 'seed']

const signal = new AbortController().signal

const SCENE = {
  title: 'Tohum',
  answer: 'Tohum çimlenir.',
  prompt: 'Filizlenen tohum',
  blockLabel: 'Dokun ve keşfet',
  states: ['before', 'after', 'static'],
}

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!(error instanceof AiProviderError)) throw new Error(`expected an AiProviderError`)
  return error
}

describe('fake AI provider of the Edge Function', () => {
  it('answers exactly like the mock backend’s fake provider', () => {
    for (const topic of TOPICS) {
      expect(pickEmoji(topic)).toBe(app.pickEmoji(topic))
      expect(fakeIconSvg(topic, 0)).toBe(app.fakeIconSvg(topic, 0))
      expect(fakeIconSvg(topic, 1)).toBe(app.fakeIconSvg(topic, 1))
      expect(maliciousSvg(topic)).toBe(app.maliciousSvg(topic))
      for (const blockType of BLOCKS) {
        expect(fakeCardText(topic, blockType)).toEqual(app.fakeCardText(topic, blockType))
      }
      for (const state of STATES) {
        for (const variant of [0, 3]) {
          const frame = { title: topic || 'Sahne', topic: `${topic} deney`, state, variant }
          expect(fakeSceneSvg(frame)).toBe(app.fakeSceneSvg(frame))
        }
      }
      const request = { topic, ageMin: 7, ageMax: 11, cardCount: 5 }
      expect(fakeKitMeta(topic, 7, 11, 5)).toEqual(topicKitMeta(request))
    }
    expect(FAKE_TRIGGERS).toEqual(app.FAKE_TRIGGERS)
  })

  it('draws SVGs that pass the app’s contract and are well-formed XML', () => {
    for (const topic of TOPICS) {
      for (const state of STATES) {
        const svg = fakeSceneSvg({ title: topic || 'Sahne', topic, state })
        expect(checkAiSvg(svg)).toEqual([])
        expect(isWellFormedSvg(svg)).toBe(true)
      }
      for (const variant of [0, 1]) {
        const icon = fakeIconSvg(topic || 'ikon', variant)
        expect(checkAiSvg(icon, { maxBytes: AI_ICON_MAX_BYTES, requireViewBox: false })).toEqual([])
        expect(isWellFormedSvg(icon)).toBe(true)
      }
    }
    expect(checkAiSvg(maliciousSvg('x'))).toEqual(
      expect.arrayContaining(['script', 'event-handler', 'external-reference']),
    )
  })

  it('implements the provider contract', async () => {
    const provider = createFakeProvider({ random: () => 0 })

    const scene = await provider.scene(SCENE, { index: 0, count: 1 }, signal)
    expect(scene.model).toBe('fake')
    expect(scene.value.alt).toBe('Tohum: yapay zekâ ile çizilmiş sahne')
    expect(scene.value.states.map((frame) => frame.state)).toEqual(SCENE.states)
    expect(scene.value.states[0]?.svg).toBe(
      fakeSceneSvg({
        title: 'Tohum',
        topic: 'Filizlenen tohum Tohum Tohum çimlenir.',
        state: 'before',
        variant: 0,
      }),
    )

    const icons = await provider.icons('roket', signal)
    expect(icons.value).toEqual([fakeIconSvg('roket', 0), fakeIconSvg('roket', 1)])

    const text = await provider.cardText(
      {
        topic: '',
        title: 'Mıknatıs',
        blockType: 'quiz',
        blockLabel: 'Soru',
        blockDescription: '',
        ageMin: 6,
        ageMax: 10,
      },
      signal,
    )
    expect(text.value).toEqual(fakeCardText('Mıknatıs', 'quiz'))

    const kit = await provider.kit(
      {
        topic: 'Su döngüsü',
        ageMin: 7,
        ageMax: 11,
        categories: ['water', 'other'],
        cards: ['info', 'quiz'].map((blockType) => ({
          blockType,
          blockLabel: blockType,
          blockDescription: '',
        })),
      },
      signal,
    )
    expect(kit.value.kit).toEqual(fakeKitMeta('Su döngüsü', 7, 11, 2))
    expect(kit.value.cards).toEqual([
      fakeCardText('Su döngüsü', 'info'),
      fakeCardText('Su döngüsü', 'quiz'),
    ])
  })

  it('follows the prompt markers of the error paths', async () => {
    const provider = createFakeProvider()
    const slot = { index: 0, count: 1 }

    expect(
      (
        await failure(
          provider.scene({ ...SCENE, prompt: `deney ${FAKE_TRIGGERS.filter}` }, slot, signal),
        )
      ).kind,
    ).toBe('blocked')
    expect((await failure(provider.icons(`ay ${FAKE_TRIGGERS.timeout}`, signal))).kind).toBe(
      'timeout',
    )
    const malicious = await provider.scene(
      { ...SCENE, prompt: `sahne ${FAKE_TRIGGERS.malicious}` },
      slot,
      signal,
    )
    expect(malicious.value.states.every((frame) => checkAiSvg(frame.svg).length > 0)).toBe(true)
  })
})
