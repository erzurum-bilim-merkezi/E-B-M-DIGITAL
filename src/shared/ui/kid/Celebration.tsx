import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'

import { CelebrationContext, type CelebrateFn } from './useCelebrate'

type Burst = { id: number; message: string }

const CONFETTI_COUNT = 44
const DURATION_MS = 2200

function pseudoRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Confetti + cheer bubble (R5). The message is always announced through a polite live region;
 * with reduced motion (OS, explorer setting or kit "minimal") there is no confetti.
 */
export function CelebrationProvider({
  children,
  reduceMotion = false,
}: {
  children: ReactNode
  reduceMotion?: boolean
}) {
  const [burst, setBurst] = useState<Burst | null>(null)
  const osReduced = usePrefersReducedMotion()
  const calm = reduceMotion || osReduced

  const celebrate = useCallback<CelebrateFn>((message = '🎉 Aferin!') => {
    setBurst({ id: Date.now() + Math.random(), message })
  }, [])

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => setBurst(null), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [burst])

  const pieces = useMemo(() => {
    if (!burst || calm) return []
    const random = pseudoRandom(Math.floor(burst.id))
    return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
      const size = 8 + random() * 10
      return {
        key: index,
        left: random() * 100,
        width: size,
        height: size * 0.6,
        color: `var(--confetti-${(index % 6) + 1})`,
        duration: 1.6 + random() * 1.6,
        delay: random() * 0.5,
      }
    })
  }, [burst, calm])

  return (
    <CelebrationContext.Provider value={celebrate}>
      {children}
      <output aria-live="polite" className="sr-only">
        {burst ? <span key={burst.id}>{burst.message}</span> : null}
      </output>
      {burst && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
        >
          {pieces.map((piece) => (
            <span
              key={piece.key}
              className="absolute -top-5 rounded-[3px]"
              style={{
                left: `${piece.left}vw`,
                width: piece.width,
                height: piece.height,
                background: piece.color,
                animation: `kid-confetti-fall ${piece.duration}s linear ${piece.delay}s forwards`,
              }}
            />
          ))}
          <div
            data-testid="celebration"
            className="absolute top-[38%] left-1/2 rounded-[1.75rem] bg-kid-surface px-8 py-5 text-2xl font-bold whitespace-nowrap text-kid-success shadow-kid-card"
            style={
              calm
                ? { transform: 'translate(-50%, -50%)' }
                : {
                    animation: 'kid-cheer 1.8s cubic-bezier(.2,1.4,.4,1) forwards',
                    transform: 'translate(-50%, -50%) scale(0)',
                  }
            }
          >
            {burst.message}
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  )
}
