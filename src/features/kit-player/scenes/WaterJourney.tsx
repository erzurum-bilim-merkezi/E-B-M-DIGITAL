import type { CSSProperties } from 'react'

import { getSceneMotion, type SceneMotion } from './motion'
import { Cloud, Drop, Ground, Hills, Leaf, Sky } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds, useSceneIds } from './scene-ids'
import { round1 } from './shapes'
import type { SceneProps } from './types'

/** A drop looping along one path; `still` is where it rests in the frozen frame. */
type Traveller = { key: string; x: number; y: number; r: number; animation: string; still: string }

type DropSpec = readonly [x: number, y: number, r: number, still: string]

/**
 * Evenly spaced negative delays put every drop mid-journey from the first frame; the frozen offsets
 * follow the same order, so the static picture still shows the whole path.
 */
function travellers(name: string, seconds: number, easing: string, drops: readonly DropSpec[]) {
  return drops.map(([x, y, r, still], index): Traveller => ({
    key: `${name}-${index}`,
    x,
    y,
    r,
    still,
    animation: `${name} ${seconds}s ${easing} ${-round1((seconds * index) / drops.length)}s infinite`,
  }))
}

/** Can → soil. */
const DRIPS = travellers('kp-scene-drip', 1.5, 'ease-in', [
  [145, 131, 4.5, 'translateY(4px)'],
  [151, 131, 4, 'translateY(20px)'],
  [148, 131, 3.5, 'translateY(36px)'],
])

/** Soil → roots. */
const SEEPS = travellers('kp-scene-seep', 2.4, 'ease-out', [
  [154, 196, 3.5, 'translate(4px, 2px)'],
  [154, 196, 3.5, 'translate(13px, 8px)'],
  [154, 196, 3.5, 'translate(22px, 13px)'],
])

/** Roots → up the stem → leaves. */
const RISERS = travellers('kp-scene-rise', 3.3, 'ease-in-out', [
  [200, 192, 6.5, 'translateY(-26px)'],
  [200, 192, 6, 'translateY(-70px)'],
  [200, 192, 5.5, 'translateY(-114px)'],
])

function travellerStyle(motion: SceneMotion, drop: Traveller): CSSProperties {
  return motion.animate ? { animation: drop.animation } : { transform: drop.still }
}

function WateringCan() {
  const { url } = useSceneIds()
  return (
    <g>
      <path
        d="M-20 -20C-24 -46 16 -48 12 -20"
        fill="none"
        stroke="#1E8C7E"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M24 4L62 -9L64 -1L27 16Z"
        fill="#26A696"
        stroke="#26A696"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g transform="translate(62 -4.5) rotate(-20)">
        <path d="M-2 -4.5L7 -9.5Q10.5 0 7 9.5L-2 4.5Z" fill="#1E8C7E" strokeLinejoin="round" />
        <path
          d="M7.8 -6V6"
          stroke="#8BE3D6"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="0.1 3"
        />
      </g>
      <path
        d="M-26 -22H26Q30 -22 30.5 -18L33 18Q33.5 24 27 24H-27Q-33.5 24 -33 18L-30.5 -18Q-30 -22 -26 -22Z"
        fill={url('can')}
      />
      <ellipse cx="-2" cy="-22" rx="17" ry="3.6" fill="#1E8C7E" />
      <rect x="-22" y="-12" width="7" height="28" rx="3.5" fill="#FFFFFF" opacity="0.35" />
    </g>
  )
}

/**
 * "Bitkiler neden suya ihtiyaç duyar?": water from the can soaks into the soil, the roots take it
 * up and drops travel up the stem to the leaves. States: play (loops) · static (drops frozen mid-way).
 */
export function WaterJourney({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })

  return (
    <SceneCanvas
      ids={ids}
      title={title}
      className={className}
      defs={
        <linearGradient id={ids.id('can')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3FCDB9" />
          <stop offset="1" stopColor="#1F9A8A" />
        </linearGradient>
      }
    >
      <Sky />
      <Cloud x={14} y={40} scale={0.7} />
      <Hills top={176} />
      <Ground top={176} />

      {/* Roots under the soil. */}
      <g fill="none" stroke="#EBD9B8" strokeLinecap="round">
        <path d="M200 190C198 208 194 224 189 246" strokeWidth="6" />
        <path
          d="M199 192C184 204 166 212 142 218M201 192C216 204 236 212 260 218"
          strokeWidth="5"
        />
        <path
          d="M170 208C164 218 160 228 156 238M232 208C238 218 242 228 246 238M193 222C185 229 178 234 170 238M195 232C203 239 208 245 213 252"
          strokeWidth="3"
        />
      </g>
      <ellipse cx="150" cy="184" rx="27" ry="5.5" fill="#5E3B22" opacity="0.45" />

      {/* Watering can dripping into the soil. */}
      <g transform="translate(86 88) rotate(35)" filter={ids.url('soft')}>
        <WateringCan />
      </g>
      {DRIPS.map((drop) => (
        <g key={drop.key} style={travellerStyle(motion, drop)}>
          <Drop x={drop.x} y={drop.y} r={drop.r} />
        </g>
      ))}
      {SEEPS.map((drop) => (
        <g key={drop.key} style={travellerStyle(motion, drop)}>
          <Drop x={drop.x} y={drop.y} r={drop.r} />
        </g>
      ))}

      {/* The plant, with its water channel inside the stem. */}
      <g filter={ids.url('soft')}>
        <Leaf x={200} y={148} angle={-58} length={64} width={36} tone="light" />
        <Leaf x={200} y={116} angle={56} length={66} width={37} tone="dark" />
        <Leaf x={200} y={62} angle={8} length={46} width={27} tone="mid" />
        <path
          d="M200 194C200 150 197 104 200 52"
          fill="none"
          stroke="#3FA34D"
          strokeWidth="11"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M200 188C200 150 197.4 106 200 60"
        fill="none"
        stroke="#BDEBFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      {RISERS.map((drop) => (
        <g key={drop.key} style={travellerStyle(motion, drop)}>
          <Drop x={drop.x} y={drop.y} r={drop.r} />
        </g>
      ))}

      <text x="304" y="250" textAnchor="middle" fontSize="14" fontWeight="600" fill="#FFF3DE">
        Kökler suyu emer
      </text>
      <text
        x="316"
        y="42"
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill="#2A7A39"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        Su yukarı taşınır ⬆
      </text>
    </SceneCanvas>
  )
}
