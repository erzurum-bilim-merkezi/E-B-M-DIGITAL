import type { CSSProperties } from 'react'

import { useSceneIds } from './scene-ids'
import {
  dropPath,
  farHillsPath,
  GRASS_TUFT_PATH,
  groundEdgePath,
  groundPath,
  leafPath,
  lettuceLeafPath,
  nearHillsPath,
  round1,
  sparklePath,
  veinPath,
} from './shapes'

/*
 * Drawing parts shared by the library scenes. One visual language: soft sky, pale hills, a rounded
 * soil mound with a lighter lip, flat shapes with a gentle gradient, the `soft` drop shadow on raised
 * objects and a contact shadow where things touch the ground.
 */

type Point = { x: number; y: number }

export function Sky() {
  const { url } = useSceneIds()
  return <rect width="400" height="260" fill={url('sky')} />
}

export function Hills({ top }: { top: number }) {
  return (
    <g>
      <path d={farHillsPath(top)} fill="#CDEBC3" />
      <path d={nearHillsPath(top)} fill="#B4DEA5" />
    </g>
  )
}

export function Cloud({ x, y, scale = 1 }: Point & { scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#FFFFFF" opacity="0.9">
      <circle cx="18" cy="-10" r="10" />
      <circle cx="36" cy="-15" r="15" />
      <circle cx="54" cy="-8" r="8" />
      <rect x="6" y="-10" width="56" height="10" rx="5" />
    </g>
  )
}

const PEBBLES = [
  [54, 34, 5, 3.6],
  [148, 50, 4, 3],
  [322, 40, 6, 4.2],
  [262, 58, 3.6, 2.6],
  [98, 62, 3, 2.2],
  [372, 60, 4, 3],
] as const

const TUFTS = [28, 66, 336, 376] as const

/** Rounded soil mound: lighter lip, darker body, a few pebbles and grass tufts at the sides. */
export function Ground({ top }: { top: number }) {
  const { url } = useSceneIds()
  return (
    <g>
      <path d={groundPath(top)} fill="#A9744F" />
      <path
        d={groundEdgePath(top + 1.6)}
        fill="none"
        stroke="#C4915F"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d={groundPath(top + 11)} fill={url('soil')} />
      <g fill="#6E4629">
        {PEBBLES.map(([x, dy, rx, ry]) => (
          <ellipse key={x} cx={x} cy={top + dy} rx={rx} ry={ry} />
        ))}
      </g>
      {TUFTS.map((x, index) => (
        <path
          key={x}
          transform={`translate(${x} ${top + 10}) scale(${index % 2 === 0 ? 1 : -0.85} 0.9)`}
          d={GRASS_TUFT_PATH}
          fill="#5DB466"
        />
      ))}
    </g>
  )
}

export function ContactShadow({
  cx,
  cy,
  rx,
  ry,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#4A2E1A" opacity="0.24" />
}

const SUN_RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)

type SunProps = {
  cx: number
  cy: number
  r: number
  /** Motion for the glow around the sun; the disc and rays stay still. */
  haloStyle?: CSSProperties
  haloClassName?: string
}

export function Sun({ cx, cy, r, haloStyle, haloClassName }: SunProps) {
  const { url } = useSceneIds()
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={round1(r * 1.9)}
        fill={url('halo')}
        style={haloStyle}
        className={haloClassName}
      />
      <g stroke="#FFC93E" strokeWidth="5.5" strokeLinecap="round">
        {SUN_RAYS.map((angle) => (
          <line
            key={angle}
            x1={round1(cx + Math.cos(angle) * (r + 8))}
            y1={round1(cy + Math.sin(angle) * (r + 8))}
            x2={round1(cx + Math.cos(angle) * (r + 17))}
            y2={round1(cy + Math.sin(angle) * (r + 17))}
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} fill={url('sun')} />
      <ellipse
        cx={round1(cx - r * 0.34)}
        cy={round1(cy - r * 0.38)}
        rx={round1(r * 0.3)}
        ry={round1(r * 0.18)}
        transform={`rotate(-32 ${round1(cx - r * 0.34)} ${round1(cy - r * 0.38)})`}
        fill="#FFFFFF"
        opacity="0.5"
      />
    </g>
  )
}

type SeedProps = Point & {
  scale?: number
  /** Renders the cracks; the style drives how they appear. */
  crackStyle?: CSSProperties
}

/** Seed resting in a small hollow of the soil, drawn around (x, y). */
export function Seed({ x, y, scale = 1, crackStyle }: SeedProps) {
  const { url } = useSceneIds()
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cy="3" rx="31" ry="20.5" fill="#5E3B22" opacity="0.26" />
      <ellipse rx="26" ry="18" fill={url('seed')} stroke="#7A4B2C" strokeWidth="3" />
      <ellipse
        cx="-9"
        cy="-8"
        rx="8"
        ry="4.2"
        transform="rotate(-16 -9 -8)"
        fill="#FFFFFF"
        opacity="0.42"
      />
      {crackStyle && (
        <path
          style={crackStyle}
          d="M-16 -5L-10 -10.5L-4.5 -5L1 -12L6.5 -5L11.5 -10.5L16.5 -5"
          fill="none"
          stroke="#5E3B22"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  )
}

type LeafTone = 'light' | 'mid' | 'dark'

const VEIN: Record<LeafTone, string> = { light: '#3E9D4A', mid: '#2B823D', dark: '#A6E39A' }

type LeafProps = Point & { angle: number; length: number; width: number; tone?: LeafTone }

/** Leaf attached at (x, y), rotated `angle` degrees from pointing straight up. */
export function Leaf({ x, y, angle, length, width, tone = 'light' }: LeafProps) {
  const { url } = useSceneIds()
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={leafPath(length, width)} fill={url(`leaf-${tone}`)} />
      <path
        d={veinPath(length)}
        fill="none"
        stroke={VEIN[tone]}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>
  )
}

export function Stem({ d, width = 8 }: { d: string; width?: number }) {
  return <path d={d} fill="none" stroke="#3FA34D" strokeWidth={width} strokeLinecap="round" />
}

/** Young two-leaf sprout rising from its base at (x, y), about 100 units tall at scale 1. */
export function Sprout({ x, y, scale = 1 }: Point & { scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <Leaf x={0} y={-48} angle={-46} length={56} width={31} tone="light" />
      <Leaf x={0} y={-60} angle={42} length={58} width={32} tone="dark" />
      <Stem d="M0 0C0 -24 -2.5 -44 0 -66" />
    </g>
  )
}

type LettuceLeafSpec = {
  angle: number
  length: number
  width: number
  fill: 'leaf-dark' | 'leaf-mid' | 'leaf-light' | 'leaf-heart'
}

/** Back to front: low leaves on the soil, tall outer leaves, lighter inner leaves, the pale heart. */
const LETTUCE_LEAVES: readonly LettuceLeafSpec[] = [
  { angle: -58, length: 70, width: 44, fill: 'leaf-mid' },
  { angle: 58, length: 70, width: 44, fill: 'leaf-mid' },
  { angle: -38, length: 98, width: 56, fill: 'leaf-dark' },
  { angle: 38, length: 98, width: 56, fill: 'leaf-dark' },
  { angle: -15, length: 124, width: 60, fill: 'leaf-dark' },
  { angle: 15, length: 124, width: 60, fill: 'leaf-dark' },
  { angle: -26, length: 106, width: 56, fill: 'leaf-mid' },
  { angle: 26, length: 106, width: 56, fill: 'leaf-mid' },
  { angle: -8, length: 110, width: 54, fill: 'leaf-light' },
  { angle: 8, length: 110, width: 54, fill: 'leaf-light' },
  { angle: 0, length: 74, width: 36, fill: 'leaf-heart' },
]

const LETTUCE_SHAPES = LETTUCE_LEAVES.map(({ angle, length, width, fill }) => ({
  key: `${angle}:${length}`,
  angle,
  fill,
  d: lettuceLeafPath(length, width),
  vein: veinPath(length),
}))

/** Romaine lettuce (marul) growing from its base at (x, y): about 170 × 120 units at scale 1. */
export function Lettuce({ x, y, scale = 1 }: Point & { scale?: number }) {
  const { url } = useSceneIds()
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {LETTUCE_SHAPES.map((leaf) => (
        <g key={leaf.key} transform={`rotate(${leaf.angle})`}>
          <path
            d={leaf.d}
            fill={url(leaf.fill)}
            stroke="#2A7A39"
            strokeOpacity="0.3"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d={leaf.vein}
            fill="none"
            stroke="#E9FADF"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      ))}
    </g>
  )
}

type DropProps = Point & { r?: number; style?: CSSProperties }

/** Water drop whose round part is centred on (x, y). */
export function Drop({ x, y, r = 6, style }: DropProps) {
  const { url } = useSceneIds()
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        <path
          d={dropPath(r)}
          fill={url('drop')}
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <ellipse
          cx={round1(-r * 0.36)}
          cy={round1(-r * 0.22)}
          rx={round1(r * 0.2)}
          ry={round1(r * 0.34)}
          fill="#FFFFFF"
          opacity="0.8"
        />
      </g>
    </g>
  )
}

type SparkleProps = Point & { r: number; color?: string; style?: CSSProperties; className?: string }

export function Sparkle({ x, y, r, color = '#FFD653', style, className }: SparkleProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={sparklePath(r)} fill={color} style={style} className={className} />
    </g>
  )
}

const THERMOMETER_TICKS = [0.32, 0.52, 0.72] as const

/** Thermometer standing on its bulb at (x, y). */
export function Thermometer({ x, y, height = 42 }: Point & { height?: number }) {
  const column = round1(height * 0.62)
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-6"
        y={-height}
        width="12"
        height={height + 4}
        rx="6"
        fill="#FFFFFF"
        stroke="#B8C7D9"
        strokeWidth="2"
      />
      <rect x="-2.5" y={-column} width="5" height={column} rx="2.5" fill="#F0605F" />
      <g stroke="#B8C7D9" strokeWidth="2" strokeLinecap="round">
        {THERMOMETER_TICKS.map((k) => (
          <line key={k} x1="9" x2="13" y1={round1(-height * k)} y2={round1(-height * k)} />
        ))}
      </g>
      <circle r="9.5" fill="#F0605F" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="-3" cy="-3" r="2.6" fill="#FFFFFF" opacity="0.6" />
    </g>
  )
}
