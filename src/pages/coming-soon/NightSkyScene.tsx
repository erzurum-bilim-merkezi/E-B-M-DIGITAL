import { useId, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'

const WIDTH = 1440
const HEIGHT = 900

/** A summit: centre x, height above the range's base, and how quickly its slopes fall off. */
type Peak = readonly [x: number, height: number, falloff: number]
type RangeSpec = { base: number; peaks: readonly Peak[]; texture: number; phase: number }

// Three ranges, far → near (viewBox units, y grows downwards).
const FAR: RangeSpec = {
  base: 650,
  peaks: [
    [60, 60, 90],
    [330, 105, 120],
    [560, 70, 80],
    [840, 140, 150],
    [1150, 90, 110],
    [1390, 70, 90],
  ],
  texture: 4,
  phase: 1.3,
}
const MID: RangeSpec = {
  base: 735,
  peaks: [
    [200, 55, 160],
    [520, 45, 130],
    [800, 60, 170],
    [1110, 75, 95],
    [1360, 50, 140],
  ],
  texture: 3,
  phase: 4.2,
}
const NEAR: RangeSpec = {
  base: 830,
  peaks: [
    [150, 40, 220],
    [700, 30, 260],
    [1250, 45, 240],
  ],
  texture: 2.5,
  phase: 7.9,
}

/** Exponential peaks give pointed summits with concave slopes — reads as mountains, not dunes. */
function rangeY({ base, peaks, texture, phase }: RangeSpec, x: number) {
  let lift = 0
  for (const [centre, height, falloff] of peaks) {
    lift += height * Math.exp(-Math.abs(x - centre) / falloff)
  }
  const roughness =
    texture * (0.6 * Math.sin(x / 23 + phase) + 0.4 * Math.sin(x / 9.7 + phase * 2.3))
  return base - lift + roughness
}

/** Closed silhouette: smooth curve through samples of `lineY`, then down to the bottom edge. */
function silhouette(lineY: (x: number) => number, step = 16) {
  const points: Array<[number, number]> = []
  for (let x = 0; x <= WIDTH; x += step) points.push([x, lineY(x)])

  let d = `M0 ${HEIGHT} L0 ${lineY(0).toFixed(1)}`
  for (const [index, [x, y]] of points.entries()) {
    const next = points[index + 1]
    if (!next) continue
    // Quadratic curve through each sample, ending halfway to the next one → no kinks.
    d += ` Q${x} ${y.toFixed(1)} ${((x + next[0]) / 2).toFixed(1)} ${((y + next[1]) / 2).toFixed(1)}`
  }
  return `${d} L${WIDTH} ${lineY(WIDTH).toFixed(1)} L${WIDTH} ${HEIGHT} Z`
}

const RIDGES = {
  far: silhouette((x) => rangeY(FAR, x)),
  mid: silhouette((x) => rangeY(MID, x)),
  near: silhouette((x) => rangeY(NEAR, x)),
}

// Only summits above this (slightly ragged) line carry snow.
const SNOWLINE = 562
const SNOW_CLIP = (() => {
  let d = `M0 0 L${WIDTH} 0`
  for (let x = WIDTH; x >= 0; x -= 12) {
    const y = SNOWLINE + 5 * Math.sin(x / 13.7) + 3 * Math.sin(x / 5.3)
    d += ` L${x} ${y.toFixed(1)}`
  }
  return `${d} Z`
})()

/** Seeded PRNG (mulberry32) so the star field never changes between renders. */
function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Where the copy sits (desktop left column, mobile right-anchored crop): keep stars faint there. */
function behindText(x: number, y: number) {
  return (x < 820 && y > 120 && y < 500) || (x > 1000 && y > 110 && y < 470)
}

const next = random(20260924)
const STARS = Array.from({ length: 130 }, (_, index) => {
  const x = next() * WIDTH
  const y = next() ** 1.4 * 560 // denser towards the zenith
  const r = 0.55 + next() * 1.1
  const opacity = 0.4 + next() * 0.55
  const twinkle = index % 9 === 0 ? `${(next() * 5).toFixed(2)}s` : undefined
  const faint = behindText(x, y)
  return { x, y, r, opacity: faint ? opacity * 0.4 : opacity, twinkle: faint ? undefined : twinkle }
}).filter((star) => !(behindText(star.x, star.y) && star.r < 0.85))

const OBSERVATORY_X = 1110
const OBSERVATORY_Y = rangeY(MID, OBSERVATORY_X) + 2

const ORBIT = { rx: 170, ry: 46 }
const ORBIT_BACK = `M ${-ORBIT.rx} 0 A ${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${ORBIT.rx} 0`
const ORBIT_FRONT = `M ${ORBIT.rx} 0 A ${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${-ORBIT.rx} 0`
// Starts on the left and passes behind the planet first, then in front of it.
const ORBIT_PATH = `${ORBIT_BACK} A ${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${-ORBIT.rx} 0`
const ORBIT_DURATION = '26s'

type Props = { className?: string }

/**
 * Winter night over Erzurum's mountains: an observatory on a summit with its lights on
 * (work is in progress), a planet with a satellite in orbit, and a quiet star field.
 * Decorative only — hidden from assistive technology.
 */
export function NightSkyScene({ className }: Props) {
  const uid = useId().replace(/[^\w-]/g, '')
  const reduceMotion = usePrefersReducedMotion()
  const id = (name: string) => `${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none select-none', className)}
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-night-950)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-night-800)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-night-600)' }} />
        </linearGradient>
        <radialGradient id={id('horizon')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: 'var(--color-night-600)', stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-night-600)', stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient
          id={id('far')}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="500"
          x2="0"
          y2="660"
        >
          <stop offset="0" style={{ stopColor: 'var(--color-night-600)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-night-700)' }} />
        </linearGradient>
        <linearGradient
          id={id('snow')}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="500"
          x2="0"
          y2="566"
        >
          <stop offset="0" style={{ stopColor: 'var(--color-snow-50)', stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-ice-200)', stopOpacity: 0.7 }} />
        </linearGradient>
        <linearGradient
          id={id('mid')}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="630"
          x2="0"
          y2="780"
        >
          <stop offset="0" style={{ stopColor: 'var(--color-night-800)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-night-900)' }} />
        </linearGradient>
        <radialGradient id={id('planet')} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" style={{ stopColor: 'var(--color-snow-50)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--color-ice-200)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-night-600)' }} />
        </radialGradient>
        <radialGradient id={id('planet-shadow')} cx="0.78" cy="0.82" r="0.8">
          <stop offset="0" style={{ stopColor: 'var(--color-night-900)', stopOpacity: 0.85 }} />
          <stop offset="0.6" style={{ stopColor: 'var(--color-night-900)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={id('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.45" style={{ stopColor: 'var(--color-ice-200)', stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-ice-200)', stopOpacity: 0 }} />
        </radialGradient>
        <clipPath id={id('snowline')}>
          <path d={SNOW_CLIP} />
        </clipPath>
        <filter id={id('glow')} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill={url('sky')} />

      <g className="fill-snow-50">
        {STARS.map((star) => (
          <circle
            key={`${star.x.toFixed(1)}-${star.y.toFixed(1)}`}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fillOpacity={star.opacity}
            className={star.twinkle ? 'animate-twinkle' : undefined}
            style={star.twinkle ? { animationDelay: star.twinkle } : undefined}
          />
        ))}
      </g>

      {/* Planet and orbit: desktop composition only — on small screens it would sit behind the text. */}
      <g transform="translate(1160 250)" className="max-md:hidden">
        <circle r="96" fill={url('halo')} />
        <g transform="rotate(-16)">
          <path
            d={ORBIT_BACK}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            strokeWidth="1.25"
            className="animate-draw stroke-ice-200 [animation-delay:200ms]"
            strokeOpacity="0.3"
          />
          {!reduceMotion && (
            <Satellite glow={url('glow')}>
              <animateMotion dur={ORBIT_DURATION} repeatCount="indefinite" path={ORBIT_PATH} />
              <animate
                attributeName="opacity"
                values="1;0"
                keyTimes="0;0.5"
                calcMode="discrete"
                dur={ORBIT_DURATION}
                repeatCount="indefinite"
              />
            </Satellite>
          )}
        </g>
        <circle r="46" fill={url('planet')} />
        <circle r="46" fill={url('planet-shadow')} />
        <g transform="rotate(-16)">
          <path
            d={ORBIT_FRONT}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            strokeWidth="1.25"
            className="animate-draw stroke-ice-200 [animation-delay:900ms]"
            strokeOpacity="0.55"
          />
          {reduceMotion ? (
            <Satellite glow={url('glow')} x={120} y={32.5} />
          ) : (
            <Satellite glow={url('glow')}>
              <animateMotion dur={ORBIT_DURATION} repeatCount="indefinite" path={ORBIT_PATH} />
              <animate
                attributeName="opacity"
                values="0;1"
                keyTimes="0;0.5"
                calcMode="discrete"
                dur={ORBIT_DURATION}
                repeatCount="indefinite"
              />
            </Satellite>
          )}
        </g>
      </g>

      <ellipse cx="960" cy="640" rx="820" ry="220" fill={url('horizon')} opacity="0.5" />

      <path d={RIDGES.far} fill={url('far')} />
      <path d={RIDGES.far} fill={url('snow')} clipPath={url('snowline')} />

      {/* The observatory keeps its lights on: work is in progress. The next ridge grounds its base. */}
      <g transform={`translate(${OBSERVATORY_X} ${OBSERVATORY_Y.toFixed(1)}) scale(0.8)`}>
        <circle cy="-30" r="34" className="fill-lamp" opacity="0.22" filter={url('glow')} />
        <rect x="-22" y="-20" width="44" height="44" rx="2" className="fill-night-950" />
        <path d="M -22 -20 A 22 19 0 0 1 22 -20 Z" className="fill-night-950" />
        <rect x="-2.5" y="-37" width="5" height="15" rx="1.5" className="fill-lamp" />
        <rect
          x="-2"
          y="-49"
          width="4"
          height="15"
          rx="1"
          transform="rotate(16 0 -34)"
          className="fill-night-950"
        />
        <rect x="9" y="-12" width="4" height="4" rx="0.8" className="fill-lamp" opacity="0.8" />
      </g>

      <path d={RIDGES.mid} fill={url('mid')} />
      <path d={RIDGES.near} className="fill-night-950" />
    </svg>
  )
}

type SatelliteProps = {
  glow: string
  x?: number
  y?: number
  children?: ReactNode
}

function Satellite({ glow, x = 0, y = 0, children }: SatelliteProps) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" className="fill-ice-200" opacity="0.35" filter={glow} />
      <circle cx={x} cy={y} r="3.5" className="fill-snow-50" />
      {children}
    </g>
  )
}
