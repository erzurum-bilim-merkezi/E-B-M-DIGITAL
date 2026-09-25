import { z } from 'zod'

import { mediaRefSchema } from './primitives.ts'

/** Scene state names ("before", "after", "static", "sun" …) — shared by library and AI scenes. */
export const sceneStateSchema = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/)

/** Frame shown when motion is paused (WCAG 2.2.2) or reduced; every AI scene must provide it. */
export const STATIC_STATE = 'static'

export const SCENE_IDS = [
  'seed-sprout',
  'lettuce-growth',
  'greenhouse',
  'leaf-kitchen',
  'water-journey',
  'germination',
  'emoji-stage',
] as const
export const sceneIdSchema = z.enum(SCENE_IDS)
export type SceneId = z.infer<typeof sceneIdSchema>

type SceneMeta = {
  label: string
  description: string
  /** States the drawing can show; `null` = any state name (driven by props, e.g. emoji). */
  states: readonly string[] | null
  /** Loops or runs longer than 5 s → the player shows a pause control (WCAG 2.2.2). */
  animated: boolean
}

/** Hand-drawn library scenes (React SVG components in the player). */
export const SCENE_CATALOG: Record<SceneId, SceneMeta> = {
  'seed-sprout': {
    label: 'Tohumdan filiz',
    description: 'Tohum çatlar ve filiz çıkar',
    states: ['before', 'after', STATIC_STATE],
    animated: false,
  },
  'lettuce-growth': {
    label: 'Marulun büyümesi',
    description: 'Tohum → çimlenme → fide → marul',
    states: ['seed', 'sprout', 'seedling', 'grown', STATIC_STATE],
    animated: false,
  },
  greenhouse: {
    label: 'Sera',
    description: 'Işık, su, sıcaklık ve hava öğeleri parlar',
    states: ['idle', 'sun', 'water', 'temp', 'air', STATIC_STATE],
    animated: false,
  },
  'leaf-kitchen': {
    label: 'Yaprağın mutfağı',
    description: 'Işık açılınca yaprak besin üretir',
    states: ['off', 'on', STATIC_STATE],
    animated: true,
  },
  'water-journey': {
    label: 'Suyun yolculuğu',
    description: 'Su damlaları kökten yapraklara taşınır',
    states: ['play', STATIC_STATE],
    animated: true,
  },
  germination: {
    label: 'Çimlenme',
    description: 'Doğru ihtiyaçlar verilince tohum çimlenir',
    states: ['idle', 'success', STATIC_STATE],
    animated: false,
  },
  'emoji-stage': {
    label: 'Emoji sahnesi',
    description: 'Seçili emojiyi büyük ve hareketli gösterir',
    states: null,
    animated: false,
  },
}

export function sceneSupportsState(sceneId: SceneId, state: string) {
  const states = SCENE_CATALOG[sceneId].states
  return states === null || states.includes(state)
}

export const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/)

export const httpsUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  }, 'Yalnızca https:// ile başlayan bağlantılar kabul edilir')

/** Video is linked, never uploaded (storage and egress quotas — ADR 0020). */
export const videoSourceSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('youtube'),
    videoId: youtubeIdSchema,
    hasSpeech: z.boolean(),
    /** "YouTube'da Türkçe altyazı var" — required when the video has speech (WCAG 1.2.2). */
    captionsConfirmed: z.boolean(),
  }),
  z.object({
    provider: z.literal('mp4'),
    url: httpsUrlSchema,
    hasSpeech: z.boolean(),
    /** WebVTT captions asset — required when the video has speech. */
    captions: mediaRefSchema.optional(),
  }),
])
export type VideoSource = z.infer<typeof videoSourceSchema>

export const aiSceneStateSchema = z.object({ state: sceneStateSchema, media: mediaRefSchema })

export const visualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scene'), sceneId: sceneIdSchema }),
  z.object({
    kind: z.literal('ai-scene'),
    /** Text alternative, taken from the generated SVG's <desc>. */
    alt: z.string().max(240),
    states: z.array(aiSceneStateSchema).max(8),
  }),
  z.object({ kind: z.literal('image'), media: mediaRefSchema }),
  z.object({ kind: z.literal('video'), source: videoSourceSchema }),
])
export type Visual = z.infer<typeof visualSchema>
export type VisualKind = Visual['kind']

export const videoVisualSchema = z.object({ kind: z.literal('video'), source: videoSourceSchema })
export type VideoVisual = z.infer<typeof videoVisualSchema>
