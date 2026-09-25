import type { CSSProperties } from 'react'

import { STATIC_STATE } from '@/entities/kit'

import type { SceneProps } from './types'

export const EASE_OUT = 'cubic-bezier(0.25, 1, 0.5, 1)'
export const EASE_SPRING = 'cubic-bezier(0.2, 1.4, 0.4, 1)'
export const EASE_POP = 'cubic-bezier(0.2, 1.6, 0.4, 1)'

export type SceneMotion = {
  /** Keyframe animations (loops and entrances) may run. */
  animate: boolean
  /** State changes may transition; otherwise they switch instantly. */
  smooth: boolean
}

/**
 * Paused (WCAG 2.2.2, kit motion "minimal") or reduced motion: no keyframes at all and instant
 * state changes. The `static` state is the still frame itself, so it never runs keyframes either.
 */
export function getSceneMotion({
  state,
  paused,
  reducedMotion,
}: Pick<SceneProps, 'state' | 'paused' | 'reducedMotion'>): SceneMotion {
  const still = paused || reducedMotion
  return { animate: !still && state !== STATIC_STATE, smooth: !still }
}

type ChangeOptions = {
  duration?: number
  /** Easing of the transform part (opacity always eases out). */
  easing?: string
  origin?: string
  delay?: number
}

/** Inline style for a part that changes between states — opacity and transform only. */
export function changes(
  motion: SceneMotion,
  style: CSSProperties,
  { duration = 450, easing = EASE_OUT, origin = 'center', delay = 0 }: ChangeOptions = {},
): CSSProperties {
  return {
    transformBox: 'fill-box',
    transformOrigin: origin,
    transition: motion.smooth
      ? `opacity ${duration}ms ${EASE_OUT} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms`
      : undefined,
    ...style,
  }
}

/** Shows or hides a part between states. */
export function fade(motion: SceneMotion, visible: boolean, options?: ChangeOptions) {
  return changes(motion, { opacity: visible ? 1 : 0 }, options)
}

/** Keyframe animation, rendered only while motion is allowed — a still frame carries none at all. */
export function keyframes(
  motion: SceneMotion,
  animation: string | false,
  origin = 'center',
): CSSProperties | undefined {
  if (!motion.animate || animation === false) return undefined
  return { animation, transformBox: 'fill-box', transformOrigin: origin }
}

/** Kâşif "sakin" motion switches decorative loops off through this class (see kids.css). */
export function ambient(motion: SceneMotion) {
  return motion.animate ? 'kid-ambient' : undefined
}
