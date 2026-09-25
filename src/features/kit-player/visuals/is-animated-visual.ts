import { SCENE_CATALOG, type Visual } from '@/entities/kit'

/** Looping visuals (animated library scenes, AI scenes) get a visible pause control. */
export function isAnimatedVisual(visual: Visual) {
  if (visual.kind === 'scene') return SCENE_CATALOG[visual.sceneId].animated
  return visual.kind === 'ai-scene'
}
