import {
  BLOCK_CATALOG,
  createDefaultStep,
  formatCardCode,
  newItemId,
  newStepId,
  sequenceItemIcon,
  shuffleStable,
  uniqueSlug,
  KIT_SCHEMA_VERSION,
  type BlockType,
  type KitCategory,
  type KitDocument,
  type Step,
} from '@/entities/kit'

import { pickEmoji } from './fake-provider'
import type { CardTextDraft, KitDraftRequest } from './port'

/*
 * Provider-independent composition of AI drafts (ADR 0018): the fake provider (mock backend) and
 * the ai-generate Edge Function (Supabase) both deliver plain texts; turning them into cards and
 * a kit document happens here, so both backends build exactly the same structures.
 */

/** Edge Function cut-off (Free plan: 150 s wall clock). */
export const AI_TIMEOUT_MS = 120_000

/** Block types of a drafted kit, card by card (repeats after eight cards). */
export const KIT_BLOCK_ROTATION: readonly BlockType[] = [
  'info',
  'tap-reveal',
  'choose-correct',
  'quiz',
  'compare-cards',
  'sequence',
  'stage-slider',
  'matching',
]

export const KIT_DRAFT_MIN_CARDS = 2
export const KIT_DRAFT_MAX_CARDS = 12

/** The kit-level texts of a draft (the cards come as one CardTextDraft each). */
export type KitMetaDraft = {
  title: string
  tagline: string
  description: string
  category: KitCategory
  learningObjectives: string[]
  badgeName: string
}

function capitalizeTr(text: string) {
  return text.charAt(0).toLocaleUpperCase('tr') + text.slice(1)
}

export function draftCardCount(requested: number) {
  return Math.min(KIT_DRAFT_MAX_CARDS, Math.max(KIT_DRAFT_MIN_CARDS, Math.trunc(requested) || 0))
}

/** One block type per card of a kit draft with `cardCount` cards. */
export function kitBlockTypes(cardCount: number): BlockType[] {
  return Array.from(
    { length: draftCardCount(cardCount) },
    (_, index) => KIT_BLOCK_ROTATION[index % KIT_BLOCK_ROTATION.length] ?? 'info',
  )
}

/** Kit texts derived from the topic alone (the fake provider's kit meta). */
export function topicKitMeta(request: KitDraftRequest): KitMetaDraft {
  const topic = request.topic.trim()
  const title = capitalizeTr(topic).slice(0, 60) || 'Yeni kit'
  const cardCount = draftCardCount(request.cardCount)
  return {
    title,
    tagline: `${request.ageMin}–${request.ageMax} yaş için ${title.toLocaleLowerCase('tr')} keşfi`,
    description: `Yapay zekâ ile hazırlanan taslak: **${title}** hakkında ${cardCount} kartlık bir keşif. Yayından önce içeriği kontrol edin.`,
    category: 'other',
    learningObjectives: [`${title} konusunu gözlem ve etkinliklerle keşfeder.`],
    badgeName: `${title} Kâşifi`,
  }
}

const TEXT_FIELDS: NonNullable<Step['aiGenerated']>['fields'] = [
  'title',
  'answer',
  'narration',
  'hint',
  'celebration',
]

/**
 * Applies a drafted card text to a card of its block type. Choice options arrive correct-first:
 * they are shuffled (stable per topic) and styled alike, so neither position, icon nor color gives
 * the answer away. Lengths are clamped to the schema limits of entities/kit.
 */
export function applyCardText(step: Step, text: CardTextDraft, topic: string): Step {
  const base = {
    ...step,
    title: text.title.slice(0, 80),
    answer: text.answer.slice(0, 2000),
    narration: text.narration.slice(0, 600),
    hint: text.hint.slice(0, 120),
    celebration: text.celebration.slice(0, 40),
  }
  if (base.type === 'info') {
    return { ...base, body: base.answer, aiGenerated: { fields: [...TEXT_FIELDS, 'body'] } }
  }
  if (base.type === 'choose-correct') {
    const icon = pickEmoji(topic)
    const choices = shuffleStable(
      text.options.slice(0, 6).map((label, index) => ({
        label: label.slice(0, 24),
        correct: index < text.correctCount,
      })),
      `${topic}:choose-correct`,
    )
    return {
      ...base,
      options: choices.map(({ label, correct }) => ({
        id: newItemId('o'),
        label,
        icon,
        color: 'sky' as const,
        correct,
        feedback: correct ? `${label} doğru!` : `${label} işe yaramaz! 😄`,
      })),
      aiGenerated: { fields: [...TEXT_FIELDS, 'options'] },
    }
  }
  if (base.type === 'quiz') {
    const answers = shuffleStable(
      text.options.slice(0, 4).map((label, index) => ({
        id: newItemId('q'),
        label: label.slice(0, 80),
        correct: index < text.correctCount,
      })),
      `${topic}:quiz`,
    )
    return {
      ...base,
      question: base.title,
      options: answers.map(({ id, label }) => ({ id, label })),
      correctOptionId: answers.find((answer) => answer.correct)?.id ?? '',
      explanation: base.answer.replace(/\*\*/g, '').slice(0, 240),
      aiGenerated: { fields: [...TEXT_FIELDS, 'options'] },
    }
  }
  if (base.type === 'sequence') {
    return {
      ...base,
      items: text.options.slice(0, 8).map((label, index) => ({
        id: newItemId('s'),
        label: label.slice(0, 40),
        icon: sequenceItemIcon(index),
      })),
      aiGenerated: { fields: [...TEXT_FIELDS, 'options'] },
    }
  }
  if (base.type === 'matching') {
    const pairs = []
    for (let i = 0; i + 1 < text.options.length && pairs.length < 5; i += 2) {
      pairs.push({
        id: newItemId('p'),
        left: (text.options[i] ?? '').slice(0, 40),
        right: (text.options[i + 1] ?? '').slice(0, 40),
      })
    }
    return { ...base, pairs, aiGenerated: { fields: [...TEXT_FIELDS, 'options'] } }
  }
  return { ...base, aiGenerated: { fields: TEXT_FIELDS } }
}

const EMPTY_TEXT: CardTextDraft = {
  title: '',
  answer: '',
  narration: '',
  hint: '',
  celebration: '',
  options: [],
  correctCount: 0,
}

/**
 * The kit document of a draft: one card per block type of `kitBlockTypes(request.cardCount)`,
 * with `cards[i]` as the text of card i. Repeated card titles get the block name, card slugs
 * follow the titles, card codes use the placeholder prefix `XX` (the wizard assigns the kit's).
 */
export function composeKit(
  request: KitDraftRequest,
  meta: KitMetaDraft,
  cards: readonly CardTextDraft[],
): Omit<KitDocument, 'id' | 'slug' | 'qrPrefix'> {
  const topic = request.topic.trim()
  const types = kitBlockTypes(request.cardCount)
  const title = meta.title.slice(0, 60) || 'Yeni kit'
  const slugs = new Set<string>()
  const titles = new Set<string>()
  const steps = types.map((type, index) => {
    const drafted = applyCardText(
      createDefaultStep(type, {
        id: newStepId(),
        slug: `kart-${index + 1}`,
        qrCode: formatCardCode('XX', index + 1),
      }),
      cards[index] ?? EMPTY_TEXT,
      topic,
    )
    const cardTitle = titles.has(drafted.title)
      ? `${capitalizeTr(topic)} · ${BLOCK_CATALOG[type].label}`.slice(0, 80)
      : drafted.title
    titles.add(cardTitle)
    const slug = uniqueSlug(cardTitle, slugs)
    slugs.add(slug)
    return { ...drafted, title: cardTitle, slug }
  })
  return {
    schemaVersion: KIT_SCHEMA_VERSION,
    version: 0,
    title,
    tagline: meta.tagline.slice(0, 120),
    description: meta.description.slice(0, 2000),
    icon: { kind: 'emoji', value: pickEmoji(topic) },
    category: meta.category,
    ageRange: { min: request.ageMin, max: request.ageMax },
    durationMinutes: types.length * 3,
    theme: { preset: 'space', font: 'playful', motion: 'full' },
    learningObjectives: meta.learningObjectives.slice(0, 10).map((line) => line.slice(0, 140)),
    materials: [],
    safetyNotes: [],
    qrSequence: types.length,
    qrEntryMode: 'full',
    badge: {
      name: meta.badgeName.slice(0, 30),
      emoji: '🏅',
      color: 'indigo',
      description: 'Tüm kartları tamamladın!',
    },
    steps,
  }
}
