import { useId } from 'react'

import { cn } from '@/shared/lib/cn'

import { MASCOT_PALETTES, type MascotColor, type MascotPose } from './mascot-palettes'

export type { MascotColor, MascotPose } from './mascot-palettes'

type MascotProps = {
  color?: MascotColor
  pose?: MascotPose
  /** Accessible name; omit for decorative use (aria-hidden). */
  label?: string
  /** Draw without the rounded space tile (e.g. inside a speech scene). */
  bare?: boolean
  className?: string
}

export function Mascot({
  color = 'indigo',
  pose = 'idle',
  label,
  bare = false,
  className,
}: MascotProps) {
  const uid = useId().replace(/:/g, '')
  const palette = MASCOT_PALETTES[color]
  const id = (name: string) => `${name}-${uid}`

  return (
    <svg
      viewBox="0 0 240 240"
      className={cn('block', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <linearGradient id={id('space')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.bg[0]} />
          <stop offset="1" stopColor={palette.bg[1]} />
        </linearGradient>
        <radialGradient id={id('glow')} cx=".5" cy=".42" r=".6">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('metal')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C9D6E8" />
        </linearGradient>
        <linearGradient id={id('visor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16324A" />
          <stop offset="1" stopColor="#0A1B2B" />
        </linearGradient>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={palette.ring} stopOpacity="0" />
          <stop offset=".5" stopColor={palette.ring} />
          <stop offset="1" stopColor={palette.ring} stopOpacity="0" />
        </linearGradient>
        <filter id={id('soft')} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#05041A" floodOpacity=".4" />
        </filter>
      </defs>

      {!bare && (
        <>
          <rect x="8" y="8" width="224" height="224" rx="56" fill={`url(#${id('space')})`} />
          <rect x="8" y="8" width="224" height="224" rx="56" fill={`url(#${id('glow')})`} />
          <g fill="#FFFFFF">
            <circle cx="46" cy="52" r="2.4" opacity=".9" />
            <circle cx="196" cy="44" r="1.8" opacity=".7" />
            <circle cx="210" cy="120" r="2" opacity=".8" />
            <circle cx="34" cy="150" r="1.6" opacity=".6" />
            <circle cx="176" cy="200" r="2.2" opacity=".7" />
            <circle cx="60" cy="204" r="1.7" opacity=".6" />
          </g>
        </>
      )}
      <path
        d="M188 74 l3.5 9 9 3.5 -9 3.5 -3.5 9 -3.5 -9 -9 -3.5 9 -3.5 Z"
        fill={palette.spark}
        className={
          pose === 'celebrate'
            ? 'kid-ambient origin-center [animation:kid-pulse_1.2s_ease-in-out_infinite] [transform-box:fill-box]'
            : undefined
        }
      />

      {/* orbit behind the head */}
      <g transform="rotate(-16 120 132)">
        <ellipse
          cx="120"
          cy="132"
          rx="100"
          ry="30"
          fill="none"
          stroke={`url(#${id('ring')})`}
          strokeWidth="7"
        />
        <circle cx="26" cy="132" r="7" fill={palette.ring} />
      </g>

      {/* antenna */}
      <line
        x1="120"
        y1="62"
        x2="120"
        y2="42"
        stroke="#C9D6E8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="120" cy="34" r="10" fill={palette.antenna} />

      {/* ears */}
      <rect
        x="46"
        y="104"
        width="18"
        height="44"
        rx="9"
        fill="#8FA7C4"
        filter={`url(#${id('soft')})`}
      />
      <rect
        x="176"
        y="104"
        width="18"
        height="44"
        rx="9"
        fill="#8FA7C4"
        filter={`url(#${id('soft')})`}
      />

      {/* waving hand */}
      {pose === 'hello' && (
        <g className="kid-ambient origin-[200px_150px] [animation:kid-wiggle_1.4s_ease-in-out_infinite]">
          <path
            d="M190 150 q18 -6 22 -26"
            stroke="#C9D6E8"
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
          />
          <circle
            cx="213"
            cy="118"
            r="11"
            fill={`url(#${id('metal')})`}
            stroke="#C9D6E8"
            strokeWidth="2"
          />
        </g>
      )}

      {/* head + visor */}
      <rect
        x="58"
        y="62"
        width="124"
        height="112"
        rx="50"
        fill={`url(#${id('metal')})`}
        filter={`url(#${id('soft')})`}
      />
      <rect x="76" y="86" width="88" height="64" rx="30" fill={`url(#${id('visor')})`} />
      <path
        d="M84 100 q36 -16 72 0"
        stroke="#FFFFFF"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        opacity=".28"
      />

      {/* face */}
      {pose === 'celebrate' ? (
        <g stroke={palette.eyes} strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M94 118 q8 -10 16 0" />
          <path d="M130 118 q8 -10 16 0" />
          <path d="M104 131 q16 14 32 0" fill={palette.eyes} fillOpacity=".25" />
        </g>
      ) : pose === 'thinking' ? (
        <g>
          <circle cx="104" cy="114" r="8" fill={palette.eyes} />
          <path d="M131 116 h16" stroke={palette.eyes} strokeWidth="6" strokeLinecap="round" />
          <path d="M110 136 h20" stroke={palette.eyes} strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="107" cy="111" r="2.6" fill="#FFFFFF" />
        </g>
      ) : (
        <g>
          <circle cx="102" cy="116" r="8.5" fill={palette.eyes} />
          <circle cx="138" cy="116" r="8.5" fill={palette.eyes} />
          <path
            d="M106 134 q14 11 28 0"
            stroke={palette.eyes}
            strokeWidth="5.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="105" cy="113" r="3" fill="#FFFFFF" opacity=".95" />
          <circle cx="141" cy="113" r="3" fill="#FFFFFF" opacity=".95" />
        </g>
      )}

      {/* orbit in front of the head */}
      <g transform="rotate(-16 120 132)">
        <path
          d="M120 162 a100 30 0 0 0 100 -30"
          fill="none"
          stroke={`url(#${id('ring')})`}
          strokeWidth="7"
          strokeLinecap="round"
          opacity=".95"
        />
        <circle cx="214" cy="132" r="7" fill={palette.spark} />
      </g>

      {/* sprout — the science + nature bridge of the brand */}
      <g transform="translate(158 52) scale(.9)">
        <path
          d="M0 18 C0 10 -1 5 0 -2"
          stroke="#8FDD8F"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M0 6 C-9 3 -13 -5 -10 -12 C-1 -10 2 -2 0 6 Z" fill="#6BC96F" />
        <path d="M0 2 C9 -1 13 -9 10 -16 C1 -14 -2 -6 0 2 Z" fill="#B9F0B0" />
      </g>

      {pose === 'thinking' && (
        <g>
          <circle cx="196" cy="70" r="16" fill="#FFFFFF" />
          <circle cx="178" cy="92" r="5" fill="#FFFFFF" />
          <text
            x="196"
            y="77"
            textAnchor="middle"
            fontSize="20"
            fontWeight="700"
            fill="#3B3486"
            fontFamily="inherit"
          >
            ?
          </text>
        </g>
      )}
    </svg>
  )
}
