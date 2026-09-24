import { z } from 'zod'

import { iconSchema } from './icons.ts'
import {
  cardColorSchema,
  cardQrCodeSchema,
  emojiSchema,
  mediaRefSchema,
  richTextSchema,
  stepIdSchema,
  stepSlugSchema,
} from './primitives.ts'
import { sceneStateSchema, videoVisualSchema, visualSchema } from './visual.ts'

/** Ids of items inside a block (options, hotspots, pairs …). */
export const itemIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/)

export const AI_FIELDS = [
  'title',
  'answer',
  'narration',
  'hint',
  'celebration',
  'body',
  'options',
  'visual',
  'icon',
] as const
export const aiProvenanceSchema = z.object({ fields: z.array(z.enum(AI_FIELDS)).max(20) })
export type AiField = (typeof AI_FIELDS)[number]

/**
 * Fields every card has. Structural limits only — content completeness (non-empty title,
 * enough options …) is checked by `validateKitForPublish`, so drafts can be saved half-done.
 */
const stepBase = {
  id: stepIdSchema,
  slug: stepSlugSchema,
  title: z.string().max(80),
  icon: iconSchema,
  cardColor: cardColorSchema,
  /** The answer box under the interaction ("cevap"). */
  answer: richTextSchema,
  /** Read aloud by "Dinle" (tr-TR speech synthesis) unless `audio` is set. */
  narration: z.string().max(600),
  audio: mediaRefSchema.optional(),
  hint: z.string().max(120),
  celebration: z.string().max(40),
  qrCode: cardQrCodeSchema,
  required: z.boolean(),
  aiGenerated: aiProvenanceSchema.optional(),
}

export const infoStepSchema = z.object({
  ...stepBase,
  type: z.literal('info'),
  visual: visualSchema.optional(),
  body: richTextSchema,
})

export const tapRevealStepSchema = z.object({
  ...stepBase,
  type: z.literal('tap-reveal'),
  visual: visualSchema.optional(),
  tapLabel: z.string().max(40),
  revealMessage: z.string().max(160),
})

export const stageSchema = z.object({
  id: itemIdSchema,
  label: z.string().max(30),
  emoji: emojiSchema,
  state: sceneStateSchema,
})

export const stageSliderStepSchema = z.object({
  ...stepBase,
  type: z.literal('stage-slider'),
  visual: visualSchema.optional(),
  stages: z.array(stageSchema).max(6),
})

export const hotspotSchema = z.object({
  id: itemIdSchema,
  label: z.string().max(24),
  icon: emojiSchema,
  color: cardColorSchema,
  message: z.string().max(160),
  state: sceneStateSchema,
})

export const exploreHotspotsStepSchema = z.object({
  ...stepBase,
  type: z.literal('explore-hotspots'),
  visual: visualSchema.optional(),
  prompt: z.string().max(80),
  hotspots: z.array(hotspotSchema).max(6),
})

export const toggleSceneStepSchema = z.object({
  ...stepBase,
  type: z.literal('toggle-scene'),
  visual: visualSchema.optional(),
  onLabel: z.string().max(30),
  offLabel: z.string().max(30),
  onMessage: z.string().max(160),
})

export const animatedSceneStepSchema = z.object({
  ...stepBase,
  type: z.literal('animated-scene'),
  visual: visualSchema.optional(),
  caption: z.string().max(160),
  staticCaption: z.string().max(160),
})

export const chooseOptionSchema = z.object({
  id: itemIdSchema,
  label: z.string().max(24),
  icon: emojiSchema,
  color: cardColorSchema,
  correct: z.boolean(),
  feedback: z.string().max(160),
})

export const chooseCorrectStepSchema = z.object({
  ...stepBase,
  type: z.literal('choose-correct'),
  visual: visualSchema.optional(),
  prompt: z.string().max(80),
  options: z.array(chooseOptionSchema).max(6),
  successMessage: z.string().max(160),
})

export const COMPARE_TONES = ['warm', 'fresh', 'cool'] as const
export const compareCardSchema = z.object({
  id: itemIdSchema,
  title: z.string().max(30),
  icon: emojiSchema,
  text: z.string().max(160),
  detail: z.string().max(200),
  tone: z.enum(COMPARE_TONES),
})

export const compareCardsStepSchema = z.object({
  ...stepBase,
  type: z.literal('compare-cards'),
  prompt: z.string().max(80),
  cards: z.array(compareCardSchema).max(3),
})

export const quizOptionSchema = z.object({ id: itemIdSchema, label: z.string().max(80) })

export const quizStepSchema = z.object({
  ...stepBase,
  type: z.literal('quiz'),
  visual: visualSchema.optional(),
  question: z.string().max(160),
  options: z.array(quizOptionSchema).max(4),
  correctOptionId: z.string().max(40),
  explanation: z.string().max(240),
})

export const sequenceItemSchema = z.object({
  id: itemIdSchema,
  label: z.string().max(40),
  icon: emojiSchema,
})

export const sequenceStepSchema = z.object({
  ...stepBase,
  type: z.literal('sequence'),
  prompt: z.string().max(120),
  /** Stored in the correct order; the player shuffles deterministically. */
  items: z.array(sequenceItemSchema).max(6),
  successMessage: z.string().max(160),
})

export const matchingPairSchema = z.object({
  id: itemIdSchema,
  left: z.string().max(40),
  right: z.string().max(40),
})

export const matchingStepSchema = z.object({
  ...stepBase,
  type: z.literal('matching'),
  prompt: z.string().max(120),
  pairs: z.array(matchingPairSchema).max(5),
  successMessage: z.string().max(160),
})

export const experimentStepItemSchema = z.object({
  id: itemIdSchema,
  text: z.string().max(200),
  /** 0 = no timer. */
  timerSec: z.int().min(0).max(600),
  image: mediaRefSchema.optional(),
})

export const experimentStepSchema = z.object({
  ...stepBase,
  type: z.literal('experiment'),
  materials: z.array(z.string().max(60)).max(15),
  safety: z.array(z.string().max(120)).max(8),
  steps: z.array(experimentStepItemSchema).max(10),
  observationPrompt: z.string().max(200),
})

export const videoStepSchema = z.object({
  ...stepBase,
  type: z.literal('video'),
  visual: videoVisualSchema.optional(),
  caption: z.string().max(160),
  questionAfter: z.string().max(160),
})

export const stepSchema = z.discriminatedUnion('type', [
  infoStepSchema,
  tapRevealStepSchema,
  stageSliderStepSchema,
  exploreHotspotsStepSchema,
  toggleSceneStepSchema,
  animatedSceneStepSchema,
  chooseCorrectStepSchema,
  compareCardsStepSchema,
  quizStepSchema,
  sequenceStepSchema,
  matchingStepSchema,
  experimentStepSchema,
  videoStepSchema,
])

export type Step = z.infer<typeof stepSchema>
export type BlockType = Step['type']
export type StepOf<T extends BlockType> = Extract<Step, { type: T }>

export type InfoStep = StepOf<'info'>
export type TapRevealStep = StepOf<'tap-reveal'>
export type StageSliderStep = StepOf<'stage-slider'>
export type ExploreHotspotsStep = StepOf<'explore-hotspots'>
export type ToggleSceneStep = StepOf<'toggle-scene'>
export type AnimatedSceneStep = StepOf<'animated-scene'>
export type ChooseCorrectStep = StepOf<'choose-correct'>
export type CompareCardsStep = StepOf<'compare-cards'>
export type QuizStep = StepOf<'quiz'>
export type SequenceStep = StepOf<'sequence'>
export type MatchingStep = StepOf<'matching'>
export type ExperimentStep = StepOf<'experiment'>
export type VideoStep = StepOf<'video'>

export const BLOCK_TYPES = [
  'info',
  'tap-reveal',
  'stage-slider',
  'explore-hotspots',
  'toggle-scene',
  'animated-scene',
  'choose-correct',
  'compare-cards',
  'quiz',
  'sequence',
  'matching',
  'experiment',
  'video',
] as const satisfies readonly BlockType[]
