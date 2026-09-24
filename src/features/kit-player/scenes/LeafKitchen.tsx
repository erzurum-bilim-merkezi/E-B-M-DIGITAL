import type { CSSProperties } from 'react'

import { STATIC_STATE } from '@/entities/kit'

import { ambient, changes, EASE_POP, fade, getSceneMotion, keyframes } from './motion'
import { Cloud, Ground, Hills, Leaf, Sky, Sparkle, Sun } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds } from './scene-ids'
import { starPath } from './shapes'
import type { SceneProps } from './types'

const STEAM = [
  'M-11 -9C-15 -15 -7 -19 -11 -26',
  'M1 -11C-3 -17 5 -21 1 -28',
  'M12 -9C8 -15 16 -19 12 -26',
] as const

const VEINS =
  'M225 176L244 150M201 154L222 120M182 130L196 100M225 176L196 185M201 154L170 161M182 130L152 128'

const STAR = starPath(13)

function Star({ x, y, style }: { x: number; y: number; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={STAR}
        fill="#FFD653"
        stroke="#FFB23F"
        strokeWidth="3"
        strokeLinejoin="round"
        style={style}
      />
    </g>
  )
}

function Apple({ x, y, style }: { x: number; y: number; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        <path
          d="M0 -8C-4 -13 -16 -13 -17 -1C-18 11 -8 18 0 15C8 18 18 11 17 -1C16 -13 4 -13 0 -8Z"
          fill="#F0605F"
        />
        <path
          d="M0 -8C0 -12 1 -15 3 -17"
          fill="none"
          stroke="#6E4629"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M3 -14C7 -20 14 -19 15 -15C11 -12 6 -12 3 -14Z" fill="#3FA34D" />
        <ellipse cx="-8" cy="-2" rx="3" ry="5" fill="#FFFFFF" opacity="0.45" />
      </g>
    </g>
  )
}

/**
 * "Bitkiler neden ışığa ihtiyaç duyar?": the leaf is the plant's kitchen. Light on → rays reach
 * the leaf, the pot steams and food appears. States: off · on · static (= on, without motion).
 */
export function LeafKitchen({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const on = state === 'on' || state === STATIC_STATE
  const loop = on && motion.animate

  const food = (index: number): CSSProperties => ({
    ...changes(motion, { opacity: on ? 1 : 0, transform: on ? 'none' : 'scale(0.3)' }),
    ...keyframes(motion, loop && `kp-scene-pop 0.8s ${EASE_POP} ${0.3 + index * 0.25}s both`),
  })

  return (
    <SceneCanvas
      ids={ids}
      title={title}
      className={className}
      defs={
        <>
          <linearGradient
            id={ids.id('beam')}
            gradientUnits="userSpaceOnUse"
            x1="80"
            y1="60"
            x2="180"
            y2="120"
          >
            <stop offset="0" stopColor="#FFF1A8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#FFE27A" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={ids.id('pot')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#80573A" />
            <stop offset="1" stopColor="#4E3019" />
          </linearGradient>
          <radialGradient id={ids.id('food-glow')}>
            <stop offset="0" stopColor="#FFE680" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFE680" stopOpacity="0" />
          </radialGradient>
        </>
      }
    >
      <Sky />
      <Cloud x={292} y={46} scale={0.8} />
      <Hills top={228} />
      <Ground top={228} />

      {/* Light rays reaching the leaf (under the sun, so they start inside its disc). */}
      <g style={fade(motion, on, { duration: 600 })}>
        <g
          className={ambient(motion)}
          style={keyframes(motion, loop && 'kp-scene-rays 1.4s ease-in-out infinite')}
        >
          <path d="M74 38L188 82L150 142L54 68Z" fill={ids.url('beam')} />
          <g stroke="#FFC93E" strokeWidth="6" strokeLinecap="round">
            <path d="M86 44L176 88M86 64L164 108M78 80L146 132" />
          </g>
        </g>
      </g>

      <g style={changes(motion, { opacity: on ? 1 : 0.6 }, { duration: 600 })}>
        <Sun
          cx={66}
          cy={56}
          r={28}
          haloClassName={ambient(motion)}
          haloStyle={keyframes(motion, loop && 'kid-pulse 1.6s ease-in-out infinite')}
        />
      </g>

      {/* The plant and its big kitchen leaf. */}
      <g filter={ids.url('soft')}>
        <Leaf x={261} y={182} angle={58} length={50} width={28} tone="dark" />
        <path
          d="M262 238C262 214 258 190 258 164"
          fill="none"
          stroke="#3FA34D"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M258 200C166 196 122 142 148 84C236 88 274 148 258 200Z"
          fill={ids.url('leaf-light')}
          stroke="#3FA34D"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M255 194C212 172 182 140 168 104"
        fill="none"
        stroke="#3FA34D"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d={VEINS}
        fill="none"
        stroke="#3FA34D"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* The kitchen: a pot on the leaf. */}
      <g transform="translate(198 138)">
        <circle cy="-6" r="34" fill={ids.url('food-glow')} style={fade(motion, on)} />
        <ellipse cy="35" rx="27" ry="4.5" fill="#2A7A39" opacity="0.35" />
        <g filter={ids.url('soft')}>
          <rect x="-35" y="7" width="10" height="7" rx="3.5" fill="#4E3019" />
          <rect x="25" y="7" width="10" height="7" rx="3.5" fill="#4E3019" />
          <path d="M-27 0H27V19Q27 34 12 34H-12Q-27 34 -27 19Z" fill={ids.url('pot')} />
          <rect x="-32" y="-6" width="64" height="10" rx="5" fill="#8A5A3B" />
        </g>
        <ellipse cy="-1" rx="25" ry="4" fill="#3E2716" />
        <g style={fade(motion, on)}>
          <ellipse cy="-1" rx="21" ry="3" fill="#FFD653" />
          <circle cx="-9" cy="-2" r="2" fill="#FFF3B0" />
          <circle cx="6" cy="-1.5" r="1.6" fill="#FFF3B0" />
          <circle cx="13" cy="-2.5" r="1.2" fill="#FFF3B0" />
        </g>
        <g
          style={fade(motion, on)}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        >
          {STEAM.map((d, index) => (
            <path
              key={d}
              d={d}
              style={keyframes(
                motion,
                loop && `kid-steam 2s ease-in-out ${-index * 0.66}s infinite`,
              )}
            />
          ))}
        </g>
      </g>

      {/* Food the leaf makes. */}
      <Star x={306} y={98} style={food(0)} />
      <Apple x={342} y={146} style={food(1)} />
      <Sparkle x={306} y={188} r={13} style={food(2)} />

      {/* Lights off: the whole scene dims. */}
      <rect
        width="400"
        height="260"
        fill="#16204F"
        style={changes(motion, { opacity: on ? 0 : 0.34 }, { duration: 600 })}
      />

      <rect x="80" y="233" width="240" height="24" rx="12" fill="#FFFFFF" opacity="0.92" />
      <text x="200" y="249.5" textAnchor="middle" fontSize="13.5" fontWeight="600" fill="#2A7A39">
        Yaprak = Bitkinin Mutfağı 👩‍🍳
      </text>
    </SceneCanvas>
  )
}
