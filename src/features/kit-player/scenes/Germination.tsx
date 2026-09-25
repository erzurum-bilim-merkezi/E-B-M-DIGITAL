import type { CSSProperties, ReactNode } from 'react'

import { STATIC_STATE } from '@/entities/kit'

import { ambient, changes, EASE_POP, EASE_SPRING, fade, getSceneMotion, keyframes } from './motion'
import { Cloud, Drop, Ground, Hills, Seed, Sky, Sparkle, Sprout, Thermometer } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds, useSceneIds } from './scene-ids'
import type { SceneProps } from './types'

const SPARKLES = [
  { x: 160, y: 94, r: 8, delay: 0.5 },
  { x: 246, y: 82, r: 9, delay: 0.7 },
] as const

/** White token of something the seed received, with a green check. */
function NeedBadge({
  x,
  y,
  style,
  children,
}: {
  x: number
  y: number
  style: CSSProperties
  children: ReactNode
}) {
  const { url } = useSceneIds()
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        <circle r="26" fill="#FFFFFF" filter={url('soft')} />
        {children}
        <g transform="translate(19 -19)">
          <circle r="9" fill="#3FA34D" stroke="#FFFFFF" strokeWidth="2.5" />
          <path
            d="M-4 0L-1 3L4 -3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  )
}

/**
 * "Tohum çimlenmek için ne ister?": a seed waiting in the soil; with water and warmth it
 * germinates. States: idle · success (sprout, moist warm soil, the two needs) · static (= success).
 */
export function Germination({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const sprouted = state === 'success' || state === STATIC_STATE

  const badge = (index: number): CSSProperties => ({
    ...changes(motion, { opacity: sprouted ? 1 : 0, transform: sprouted ? 'none' : 'scale(0.4)' }),
    ...keyframes(motion, sprouted && `kp-scene-pop 0.7s ${EASE_POP} ${0.35 + index * 0.2}s both`),
  })

  return (
    <SceneCanvas
      ids={ids}
      title={title}
      className={className}
      defs={
        <radialGradient id={ids.id('warm')}>
          <stop offset="0" stopColor="#FFB25C" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FFB25C" stopOpacity="0" />
        </radialGradient>
      }
    >
      <Sky />
      <Cloud x={34} y={62} />
      <Cloud x={292} y={46} scale={0.8} />
      <Hills top={194} />
      <Ground top={194} />

      {/* Warm, moist soil around the seed. */}
      <g style={fade(motion, sprouted, { duration: 600 })}>
        <ellipse cx="200" cy="218" rx="84" ry="34" fill={ids.url('warm')} />
        <Drop x={154} y={230} r={4.5} />
        <Drop x={248} y={226} r={4} />
        <Drop x={174} y={249} r={3.5} />
        <Drop x={230} y={247} r={3.5} />
      </g>

      <g
        style={changes(
          motion,
          { opacity: sprouted ? 1 : 0, transform: sprouted ? 'none' : 'scale(0.4, 0)' },
          { origin: '50% 100%', easing: EASE_SPRING, duration: 650 },
        )}
      >
        <g filter={ids.url('soft')}>
          <Sprout x={200} y={204} />
        </g>
      </g>
      <Seed x={200} y={213} crackStyle={fade(motion, sprouted)} />

      <NeedBadge x={108} y={100} style={badge(0)}>
        <Drop x={0} y={5} r={9} />
      </NeedBadge>
      <NeedBadge x={292} y={100} style={badge(1)}>
        <Thermometer x={0} y={10} height={26} />
      </NeedBadge>

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
