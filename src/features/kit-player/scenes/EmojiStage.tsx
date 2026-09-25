import { ambient, EASE_SPRING, getSceneMotion, keyframes } from './motion'
import { Sparkle } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds, useSceneIds } from './scene-ids'
import { groundEdgePath, groundPath, valanceEdgePath, valancePath } from './shapes'
import type { SceneProps } from './types'

const FALLBACK_EMOJI = '✨'
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"

const WALL_SPARKLES = [
  { x: 116, y: 64, r: 7, color: '#FFD653' },
  { x: 288, y: 54, r: 6, color: '#F27DA6' },
  { x: 322, y: 150, r: 5, color: '#2BE0C8' },
  { x: 92, y: 152, r: 5, color: '#FFFFFF' },
] as const

const WALL_DOTS = [
  [140, 110, 2.2],
  [262, 118, 2],
  [104, 98, 1.6],
  [302, 92, 1.8],
  [248, 40, 1.6],
] as const

const VALANCE = valancePath(22)
const VALANCE_TRIM = valanceEdgePath(19)

function Curtain({ mirrored = false }: { mirrored?: boolean }) {
  const { url } = useSceneIds()
  return (
    <g transform={mirrored ? 'translate(400 0) scale(-1 1)' : undefined}>
      <path d="M-10 -10H72C66 50 54 104 46 146C52 170 62 192 70 216H-10Z" fill={url('curtain')} />
      <g fill="none" strokeLinecap="round">
        <path
          d="M20 -10C22 60 20 130 14 216M44 -10C44 44 38 96 32 146"
          stroke="#B93443"
          strokeWidth="5"
          opacity="0.45"
        />
        <path d="M60 -10C56 40 48 92 40 140" stroke="#FF9A9A" strokeWidth="3" opacity="0.5" />
      </g>
      {/* Gold sash gathering the curtain at its waist. */}
      <g transform="rotate(-7 22 146)">
        <rect x="-8" y="140" width="58" height="11" rx="5.5" fill="#FFD653" />
        <rect x="-8" y="146" width="58" height="5" rx="2.5" fill="#F2B632" />
      </g>
      <circle cx="49" cy="143" r="6" fill="#FFD653" stroke="#F2B632" strokeWidth="2" />
    </g>
  )
}

/**
 * Generic stage: the given emoji big in a spotlight. It pops in whenever the emoji or state
 * changes and floats briefly (under 5 s, WCAG 2.2.2 — the catalog marks this scene as not
 * animated, so the player shows no pause control). Any state name works.
 */
export function EmojiStage({ state, paused, reducedMotion, title, emoji, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const shown = emoji?.trim() || FALLBACK_EMOJI

  return (
    <SceneCanvas
      ids={ids}
      title={title}
      className={className}
      defs={
        <>
          <radialGradient id={ids.id('wall')} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0" stopColor="#8E80F4" />
            <stop offset="0.55" stopColor="#5C4ED2" />
            <stop offset="1" stopColor="#3A2F96" />
          </radialGradient>
          <linearGradient id={ids.id('curtain')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F77272" />
            <stop offset="1" stopColor="#D8434F" />
          </linearGradient>
          <linearGradient id={ids.id('floor')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CB8D57" />
            <stop offset="1" stopColor="#9C623A" />
          </linearGradient>
          <linearGradient id={ids.id('beam')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id={ids.id('pool')}>
            <stop offset="0" stopColor="#FFF4CF" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFF4CF" stopOpacity="0" />
          </radialGradient>
        </>
      }
    >
      <rect width="400" height="260" fill={ids.url('wall')} />
      <g fill="#FFFFFF" opacity="0.6">
        {WALL_DOTS.map(([x, y, r]) => (
          <circle key={x} cx={x} cy={y} r={r} />
        ))}
      </g>
      {WALL_SPARKLES.map((sparkle) => (
        <Sparkle key={sparkle.x} x={sparkle.x} y={sparkle.y} r={sparkle.r} color={sparkle.color} />
      ))}

      <path d="M172 -10H228L322 212H78Z" fill={ids.url('beam')} />

      {/* Wooden stage floor, same rounded mound as the gardens' ground. */}
      <path d={groundPath(204)} fill="#E5A96F" />
      <path d={groundEdgePath(205.6)} fill="none" stroke="#F4C592" strokeWidth="2.4" />
      <path d={groundPath(214)} fill={ids.url('floor')} />
      <g fill="none" stroke="#A96C40" strokeWidth="1.6" opacity="0.5">
        <path d={groundEdgePath(230)} />
        <path d={groundEdgePath(247)} />
      </g>
      <ellipse cx="200" cy="212" rx="112" ry="16" fill={ids.url('pool')} />

      <g key={`${shown}|${state}`}>
        <ellipse
          cx="200"
          cy="213"
          rx="44"
          ry="7"
          fill="#2A1D5C"
          opacity="0.3"
          className={ambient(motion)}
          style={keyframes(motion, 'kp-scene-shadow 2.2s ease-in-out 0.5s 2')}
        />
        <g
          className={ambient(motion)}
          style={keyframes(motion, 'kid-float 2.2s ease-in-out 0.5s 2')}
        >
          <g style={keyframes(motion, `kp-scene-pop-in 0.5s ${EASE_SPRING} both`)}>
            <text
              x="200"
              y="130"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="100"
              fontFamily={EMOJI_FONT}
              fill="#FFFFFF"
            >
              {shown}
            </text>
          </g>
        </g>
      </g>

      <Curtain />
      <Curtain mirrored />
      <path d={VALANCE} fill="#E0505C" />
      <path d={VALANCE_TRIM} fill="none" stroke="#FFD653" strokeWidth="3" strokeLinecap="round" />
    </SceneCanvas>
  )
}
