import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import { SceneIdsContext, type SceneIds } from './scene-ids'

type SceneCanvasProps = {
  ids: SceneIds
  title: string
  className?: string
  /** Scene-specific gradients and filters. */
  defs?: ReactNode
  children: ReactNode
}

/**
 * 400 × 260 frame shared by every library scene: accessible name, the E-B-M illustration palette
 * and a rounded clip, so each scene carries its own background on light and dark stage cards.
 */
export function SceneCanvas({ ids, title, className, defs, children }: SceneCanvasProps) {
  const { id, url } = ids

  return (
    <SceneIdsContext value={ids}>
      <svg
        viewBox="0 0 400 260"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG is named via role="img"; an <img> cannot hold inline SVG
        role="img"
        aria-label={title}
        className={cn('block h-auto w-full select-none', className)}
      >
        <title>{title}</title>
        <defs>
          <clipPath id={id('frame')}>
            <rect width="400" height="260" rx="20" />
          </clipPath>
          <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A6DCF8" />
            <stop offset="0.62" stopColor="#D6F0FA" />
            <stop offset="1" stopColor="#EDF9EA" />
          </linearGradient>
          <linearGradient id={id('soil')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8F5D3D" />
            <stop offset="1" stopColor="#734830" />
          </linearGradient>
          <radialGradient id={id('sun')} cx="0.4" cy="0.38" r="0.7">
            <stop offset="0" stopColor="#FFF4B8" />
            <stop offset="0.55" stopColor="#FFD653" />
            <stop offset="1" stopColor="#FFBE3B" />
          </radialGradient>
          <radialGradient id={id('halo')}>
            <stop offset="0.45" stopColor="#FFE680" stopOpacity="0.65" />
            <stop offset="1" stopColor="#FFE680" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('seed')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D9A06A" />
            <stop offset="1" stopColor="#A5663C" />
          </linearGradient>
          <linearGradient id={id('leaf-light')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#92DD89" />
            <stop offset="1" stopColor="#56B45E" />
          </linearGradient>
          <linearGradient id={id('leaf-mid')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#72CC74" />
            <stop offset="1" stopColor="#3E9D4A" />
          </linearGradient>
          <linearGradient id={id('leaf-dark')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#52B35C" />
            <stop offset="1" stopColor="#2B823D" />
          </linearGradient>
          <linearGradient id={id('leaf-heart')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C6F0B4" />
            <stop offset="1" stopColor="#8FD68A" />
          </linearGradient>
          <linearGradient id={id('drop')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9ADAF6" />
            <stop offset="1" stopColor="#3AA2DC" />
          </linearGradient>
          <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1F3A2A" floodOpacity="0.2" />
          </filter>
          {defs}
        </defs>
        <g clipPath={url('frame')}>{children}</g>
      </svg>
    </SceneIdsContext>
  )
}
