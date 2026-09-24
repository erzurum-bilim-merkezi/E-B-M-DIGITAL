import { STATIC_STATE } from '@/entities/kit'

import { ambient, changes, EASE_SPRING, fade, getSceneMotion, keyframes } from './motion'
import { Cloud, Ground, Hills, Seed, Sky, Sparkle, Sprout, Sun } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds } from './scene-ids'
import type { SceneProps } from './types'

const SPARKLES = [
  { x: 142, y: 118, r: 8, delay: 0.45 },
  { x: 262, y: 96, r: 10, delay: 0.6 },
  { x: 250, y: 150, r: 6, delay: 0.75 },
] as const

/**
 * "Tohum nedir?": a seed in the soil under a warm sun; `after` cracks it open and grows the sprout.
 * States: before · after · static (= after, the informative frame).
 */
export function SeedSprout({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const sprouted = state === 'after' || state === STATIC_STATE

  return (
    <SceneCanvas ids={ids} title={title} className={className}>
      <Sky />
      <Cloud x={30} y={72} />
      <Cloud x={128} y={46} scale={0.7} />
      <Sun cx={334} cy={60} r={26} />
      <Hills top={192} />
      <Ground top={192} />

      <g
        style={changes(
          motion,
          { opacity: sprouted ? 1 : 0, transform: sprouted ? 'none' : 'scale(0.4, 0)' },
          { origin: '50% 100%', easing: EASE_SPRING, duration: 650 },
        )}
      >
        <g filter={ids.url('soft')}>
          <Sprout x={200} y={202} />
        </g>
      </g>
      <Seed x={200} y={211} crackStyle={fade(motion, sprouted)} />

      <g style={fade(motion, sprouted, { delay: sprouted ? 250 : 0 })}>
        {SPARKLES.map((sparkle) => (
          <Sparkle
            key={sparkle.x}
            x={sparkle.x}
            y={sparkle.y}
            r={sparkle.r}
            className={ambient(motion)}
            style={keyframes(
              motion,
              sprouted && `kp-scene-twinkle 1.1s ease-in-out ${sparkle.delay}s 2`,
            )}
          />
        ))}
      </g>
    </SceneCanvas>
  )
}
