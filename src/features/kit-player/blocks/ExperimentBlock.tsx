import { useEffect, useRef, useState, type RefObject } from 'react'

import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { cn } from '@/shared/lib/cn'
import { KidButton, KidPanel, SpeechBubble } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { MediaImage } from '../visuals/MediaImage'
import { useCompleteOnce, type BlockProps } from './types'

function Countdown({
  seconds,
  onDone,
  focusWhenDone,
}: {
  seconds: number
  onDone: () => void
  /** Where keyboard focus goes when the pause button disappears at 00:00. */
  focusWhenDone: RefObject<HTMLElement | null>
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()

  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => {
      const next = remaining - 1
      setRemaining(next)
      if (next <= 0) {
        setRunning(false)
        // Only move focus that would otherwise be lost — never pull it from elsewhere.
        if (document.activeElement === toggleRef.current) focusAfterUpdate(focusWhenDone)
        onDone()
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [focusAfterUpdate, focusWhenDone, onDone, remaining, running])

  const minutes = Math.floor(remaining / 60)
  const secs = remaining % 60
  const label = `${minutes > 0 ? `${minutes} dk ` : ''}${secs} sn`
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        role="timer"
        aria-label={`Kalan süre ${label}`}
        className="rounded-full bg-kid-surface-2 px-4 py-2 font-mono text-2xl font-bold tabular"
      >
        ⏱️ {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      {remaining > 0 && (
        // The label names the action ("Duraklat" / "Sayacı başlat"): no aria-pressed (4.1.2).
        <KidButton ref={toggleRef} variant="surface" onClick={() => setRunning((value) => !value)}>
          {running ? '⏸️ Duraklat' : '▶️ Sayacı başlat'}
        </KidButton>
      )}
      {/* Announce only start and end — not every second. */}
      <span className="sr-only" aria-live="polite">
        {remaining === 0 ? 'Süre doldu!' : running ? 'Sayaç çalışıyor' : ''}
      </span>
    </div>
  )
}

export function ExperimentBlock({ step, onComplete }: BlockProps<'experiment'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [index, setIndex] = useState(-1)
  const [timerDone, setTimerDone] = useState<ReadonlySet<string>>(new Set())
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const observationRef = useRef<HTMLDivElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const current = index >= 0 ? step.steps[index] : undefined
  const finished = index >= step.steps.length

  const next = () => {
    const nextIndex = index + 1
    setIndex(nextIndex)
    // "Deneye başla" and "Deneyi bitirdim" disappear once pressed: focus follows the content
    // that replaces them (the first step, the observation question). "Sonraki adım" stays put.
    if (index === -1) focusAfterUpdate(stepHeadingRef)
    else if (nextIndex >= step.steps.length) focusAfterUpdate(observationRef)
    if (nextIndex >= step.steps.length && complete())
      celebrate(step.celebration || '🧪 Deneyi tamamladın!')
  }

  return (
    <div className="flex flex-col gap-3">
      {index === -1 && (
        <>
          {step.materials.length > 0 && (
            <KidPanel>
              <h2 className="mb-3 text-xl font-bold">🧰 Malzemeler</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {step.materials.map((material, materialIndex) => (
                  <li
                    // oxlint-disable-next-line react/no-array-index-key -- static strings that may repeat or be blank
                    key={materialIndex}
                    className="flex items-center gap-2 rounded-xl bg-kid-surface-2 px-3 py-2 text-lg font-medium"
                  >
                    <span aria-hidden="true">✔️</span> {material}
                  </li>
                ))}
              </ul>
            </KidPanel>
          )}
          {step.safety.length > 0 && (
            <div
              role="note"
              className="rounded-kid border-[3px] border-kid-orange/60 bg-kid-warning-bg p-5 text-kid-fg"
            >
              <h2 className="mb-2 text-xl font-bold">⚠️ Güvenlik</h2>
              <ul className="flex list-disc flex-col gap-1 pl-6 text-lg">
                {step.safety.map((note, noteIndex) => (
                  // oxlint-disable-next-line react/no-array-index-key -- static strings that may repeat or be blank
                  <li key={noteIndex}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          <KidButton variant="accent" size="lg" onClick={next} disabled={step.steps.length === 0}>
            🧪 Deneye başla
          </KidButton>
        </>
      )}

      {current && (
        <KidPanel className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-xl font-bold outline-none">
              Adım {index + 1} / {step.steps.length}
            </h2>
            <div className="flex gap-1.5" aria-hidden="true">
              {step.steps.map((item, itemIndex) => (
                <span
                  key={item.id}
                  className={cn(
                    'size-3 rounded-full',
                    itemIndex <= index ? 'bg-kid-accent' : 'bg-kid-surface-2',
                  )}
                />
              ))}
            </div>
          </div>
          {current.image?.url && (
            <MediaImage url={current.image.url} alt={current.image.alt ?? ''} />
          )}
          <p className="text-2xl leading-relaxed font-semibold" aria-live="polite">
            {current.text}
          </p>
          {current.timerSec > 0 && (
            <Countdown
              key={current.id}
              seconds={current.timerSec}
              focusWhenDone={nextRef}
              onDone={() => setTimerDone((done) => new Set(done).add(current.id))}
            />
          )}
          <KidButton ref={nextRef} variant="accent" size="lg" onClick={next}>
            {index === step.steps.length - 1 ? '🎉 Deneyi bitirdim' : 'Sonraki adım ➜'}
          </KidButton>
          {current.timerSec > 0 && !timerDone.has(current.id) && (
            <p className="text-center text-base text-kid-fg-soft">
              İstersen sayacı bekleyebilir ya da devam edebilirsin.
            </p>
          )}
        </KidPanel>
      )}

      {/* Receives focus when the experiment ends (the button that led here is gone). */}
      {finished && (
        <SpeechBubble ref={observationRef} tabIndex={-1} tail="none">
          🔍 {step.observationPrompt}
        </SpeechBubble>
      )}
    </div>
  )
}
