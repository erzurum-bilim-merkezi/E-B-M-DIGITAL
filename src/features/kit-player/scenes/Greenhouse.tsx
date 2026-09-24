import type { CSSProperties } from 'react'

import { changes, fade, getSceneMotion, keyframes, type SceneMotion } from './motion'
import { ContactShadow, Drop, Ground, Hills, Lettuce, Sky, Sun, Thermometer } from './parts'
import { SceneCanvas } from './SceneCanvas'
import { useNewSceneIds } from './scene-ids'
import type { SceneProps } from './types'

const ELEMENTS = ['sun', 'water', 'temp', 'air'] as const
type GreenhouseElement = (typeof ELEMENTS)[number]

const GLOW_COLORS: Record<GreenhouseElement, string> = {
  sun: '#FFE066',
  water: '#7FD0F5',
  temp: '#FF8F8E',
  air: '#6FE3D2',
}

function toLit(state: string): GreenhouseElement | null {
  return ELEMENTS.find((element) => element === state) ?? null
}

/** A lit element pulses twice (like E-B-M's `.sera-el.lit`); the others dim so it stands out still. */
function elementStyle(
  motion: SceneMotion,
  lit: GreenhouseElement | null,
  element: GreenhouseElement,
): CSSProperties {
  return {
    ...changes(motion, { opacity: lit === null || lit === element ? 1 : 0.32 }),
    ...keyframes(motion, lit === element && 'kid-pulse 1s ease-in-out 2'),
  }
}

const PLANTS = [116, 152, 248, 284] as const
const SPRINKLERS = [150, 250] as const

/**
 * "Sera nedir?": a glass greenhouse with its four needs — light, water, temperature, air. A named
 * state highlights that element. States: idle · sun · water · temp · air · static (= idle).
 */
export function Greenhouse({ state, paused, reducedMotion, title, className }: SceneProps) {
  const ids = useNewSceneIds()
  const motion = getSceneMotion({ state, paused, reducedMotion })
  const lit = toLit(state)
  const glow = (element: GreenhouseElement) => fade(motion, lit === element)

  return (
    <SceneCanvas
      ids={ids}
      title={title}
      className={className}
      defs={
        <>
          <linearGradient id={ids.id('glass')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F2FBFF" stopOpacity="0.95" />
            <stop offset="1" stopColor="#C3E8FA" stopOpacity="0.9" />
          </linearGradient>
          {ELEMENTS.map((element) => (
            <radialGradient key={element} id={ids.id(`glow-${element}`)}>
              <stop offset="0.2" stopColor={GLOW_COLORS[element]} stopOpacity="0.9" />
              <stop offset="1" stopColor={GLOW_COLORS[element]} stopOpacity="0" />
            </radialGradient>
          ))}
        </>
      }
    >
      <Sky />
      <Hills top={216} />
      <Ground top={216} />

      {/* Outside: sun and fresh air. */}
      <circle cx="50" cy="50" r="50" fill={ids.url('glow-sun')} style={glow('sun')} />
      <g style={elementStyle(motion, lit, 'sun')}>
        <Sun cx={50} cy={50} r={22} />
      </g>
      <ellipse cx="334" cy="56" rx="66" ry="40" fill={ids.url('glow-air')} style={glow('air')} />
      <g
        style={elementStyle(motion, lit, 'air')}
        fill="none"
        stroke="#2BB6A3"
        strokeWidth="5"
        strokeLinecap="round"
      >
        <path d="M290 42C302 34 316 34 328 42C340 50 354 50 366 42C374 37 378 29 372 25C367 22 361 26 364 31" />
        <path d="M304 64C314 58 326 58 336 64C346 70 358 70 368 64" />
        <path d="M294 84C302 80 310 80 318 84" strokeWidth="4" />
      </g>

      {/* The greenhouse. */}
      <ContactShadow cx={200} cy={221} rx={122} ry={5} />
      <g filter={ids.url('soft')}>
        <path d="M86 220V124L200 64L314 124V220Z" fill={ids.url('glass')} />
      </g>
      <g fill="none" stroke="#4FB6E8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M86 220V124L200 64L314 124V220" strokeWidth="6" />
        <path d="M143 94V220M257 94V220M200 64V170M86 166H178M222 166H314" strokeWidth="3.5" />
      </g>
      <path
        d="M76 130L200 57L324 130"
        fill="none"
        stroke="#3597CF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="178"
        y="170"
        width="44"
        height="50"
        rx="3"
        fill="#C9EBFA"
        stroke="#4FB6E8"
        strokeWidth="3.5"
      />
      <path d="M200 170V220" stroke="#4FB6E8" strokeWidth="2.5" />
      <circle cx="194" cy="196" r="2.5" fill="#3597CF" />
      <circle cx="206" cy="196" r="2.5" fill="#3597CF" />

      {/* Beds and lettuces. */}
      <g>
        <rect x="94" y="205" width="80" height="15" rx="5" fill="#8A5A3B" />
        <rect x="226" y="205" width="80" height="15" rx="5" fill="#8A5A3B" />
        <rect x="94" y="205" width="80" height="5" rx="2.5" fill="#A9744F" />
        <rect x="226" y="205" width="80" height="5" rx="2.5" fill="#A9744F" />
      </g>
      {PLANTS.map((x) => (
        <Lettuce key={x} x={x} y={208} scale={0.22} />
      ))}

      {/* Inside: irrigation and temperature. */}
      <path d="M132 118H268" stroke="#8DC3DF" strokeWidth="3" strokeLinecap="round" />
      <g style={glow('water')}>
        {SPRINKLERS.map((x) => (
          <ellipse key={x} cx={x} cy="148" rx="30" ry="36" fill={ids.url('glow-water')} />
        ))}
      </g>
      <g style={elementStyle(motion, lit, 'water')}>
        {SPRINKLERS.map((x) => (
          <g key={x}>
            <path d={`M${x - 7} 117H${x + 7}L${x + 3.5} 127H${x - 3.5}Z`} fill="#3597CF" />
            <Drop x={x - 8} y={143} r={5.5} />
            <Drop x={x + 8} y={147} r={5} />
            <Drop x={x} y={166} r={5.5} />
          </g>
        ))}
      </g>
      <ellipse cx="290" cy="150" rx="26" ry="42" fill={ids.url('glow-temp')} style={glow('temp')} />
      <g style={elementStyle(motion, lit, 'temp')}>
        <Thermometer x={288} y={170} height={40} />
      </g>

      {/* Glass shine on top of everything inside. */}
      <g stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.7">
        <path d="M98 152L126 124M98 168L106 160M160 102L178 92M222 92L238 84" />
      </g>
    </SceneCanvas>
  )
}
