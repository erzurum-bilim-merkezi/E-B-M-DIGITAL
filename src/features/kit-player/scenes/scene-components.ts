import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

import type { SceneId } from '@/entities/kit'

import type { SceneProps } from './types'

/** Each hand-drawn scene is its own chunk; a kit only downloads the scenes it uses. */
export const SCENE_COMPONENTS = {
  'seed-sprout': lazy(() => import('./SeedSprout').then((m) => ({ default: m.SeedSprout }))),
  'lettuce-growth': lazy(() =>
    import('./LettuceGrowth').then((m) => ({ default: m.LettuceGrowth })),
  ),
  greenhouse: lazy(() => import('./Greenhouse').then((m) => ({ default: m.Greenhouse }))),
  'leaf-kitchen': lazy(() => import('./LeafKitchen').then((m) => ({ default: m.LeafKitchen }))),
  'water-journey': lazy(() => import('./WaterJourney').then((m) => ({ default: m.WaterJourney }))),
  germination: lazy(() => import('./Germination').then((m) => ({ default: m.Germination }))),
  'emoji-stage': lazy(() => import('./EmojiStage').then((m) => ({ default: m.EmojiStage }))),
} satisfies Record<SceneId, LazyExoticComponent<ComponentType<SceneProps>>>
