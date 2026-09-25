import { useEffect, useId, useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { HintText, KidButton, KidPanel, SpeechBubble } from '@/shared/ui/kid'
import { RichText } from '@/shared/ui'

import { usePlayer } from '../components/usePlayer'
import { VisualArea } from '../visuals/VisualArea'
import { useCompleteOnce, type BlockProps } from './types'

function iconEmoji(step: { icon: { kind: string; value?: string } }) {
  return step.icon.kind === 'emoji' && step.icon.value ? step.icon.value : undefined
}

function MissingVisual() {
  return (
    <div
      className="grid aspect-[400/260] w-full place-items-center rounded-[1.25rem] bg-kid-surface-2 text-5xl"
      aria-hidden="true"
    >
      ✨
    </div>
  )
}

export function InfoBlock({ step, onComplete }: BlockProps<'info'>) {
  const complete = useCompleteOnce(onComplete)
  useEffect(() => {
    complete()
  }, [complete])
  return (
    <div className="flex flex-col gap-4">
      {step.visual && (
        <KidPanel className="p-3">
          <VisualArea
            visual={step.visual}
            state="play"
            title={step.title}
            cardColor={step.cardColor}
            emoji={iconEmoji(step)}
          />
        </KidPanel>
      )}
      {step.body && (
        <KidPanel className="text-xl leading-relaxed font-medium">
          <RichText text={step.body} strongClassName="text-kid-success" />
        </KidPanel>
      )}
    </div>
  )
}

export function TapRevealBlock({ step, onComplete }: BlockProps<'tap-reveal'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [revealed, setRevealed] = useState(false)

  const reveal = () => {
    if (revealed) return
    setRevealed(true)
    if (complete()) celebrate(step.celebration || '🌱 Harika!')
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="p-3">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state={revealed ? 'after' : 'before'}
            title={step.title}
            cardColor={step.cardColor}
            emoji={iconEmoji(step)}
          >
            <button
              type="button"
              onClick={reveal}
              aria-pressed={revealed}
              aria-label={step.tapLabel || 'Dokun'}
              className="kid-focus absolute inset-0 cursor-pointer rounded-[1.25rem] disabled:cursor-default"
            />
          </VisualArea>
        ) : (
          <MissingVisual />
        )}
      </KidPanel>
      {/* Mounted before the tap (empty) so screen readers announce the message. */}
      <SpeechBubble live tail="none" className="text-center">
        {revealed ? step.revealMessage : null}
      </SpeechBubble>
      {/* The card's own hint (shown by StepShell) replaces the generic tap prompt. */}
      {!revealed && !step.hint && <HintText>👆 {step.tapLabel}</HintText>}
    </div>
  )
}

export function StageSliderBlock({ step, onComplete }: BlockProps<'stage-slider'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [index, setIndex] = useState(0)
  const id = useId()
  const stages = step.stages
  const current = stages[index]
  const last = stages.length - 1

  const change = (next: number) => {
    setIndex(next)
    if (next === last && last > 0 && complete()) celebrate(step.celebration || '🎉 Tamamladın!')
  }

  if (!current) return null
  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="flex flex-col gap-4 p-3 pb-5">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state={current.state}
            title={step.title}
            cardColor={step.cardColor}
            emoji={current.emoji}
          />
        ) : (
          <MissingVisual />
        )}
        <p
          id={`${id}-label`}
          className="text-center text-2xl font-bold text-kid-success"
          aria-live="polite"
        >
          <span aria-hidden="true">{current.emoji}</span> {current.label}
        </p>
        <div className="px-2">
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={index}
            onChange={(event) => change(Number(event.target.value))}
            aria-label="Büyüme aşaması"
            aria-valuetext={`${index + 1}. aşama: ${current.label}`}
            className="kid-range kid-focus w-full"
          />
          <div className="mt-2 flex justify-between px-1 text-2xl" aria-hidden="true">
            {stages.map((stage, stageIndex) => (
              <button
                key={stage.id}
                type="button"
                tabIndex={-1}
                onClick={() => change(stageIndex)}
                className={cn(
                  'transition-[transform,opacity] duration-300',
                  stageIndex === index ? 'scale-125 opacity-100' : 'opacity-40',
                )}
              >
                {stage.emoji}
              </button>
            ))}
          </div>
        </div>
      </KidPanel>
    </div>
  )
}

export function ExploreHotspotsBlock({ step, onComplete }: BlockProps<'explore-hotspots'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [selected, setSelected] = useState<string | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const current = step.hotspots.find((hotspot) => hotspot.id === selected)

  const pick = (id: string) => {
    setSelected(id)
    const next = new Set(seen).add(id)
    setSeen(next)
    if (next.size === step.hotspots.length && complete())
      celebrate(step.celebration || '🎉 Hepsini keşfettin!')
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="p-3">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state={current?.state ?? 'idle'}
            title={step.title}
            cardColor={step.cardColor}
            emoji={current?.icon}
          />
        ) : (
          <MissingVisual />
        )}
      </KidPanel>
      <div
        className={cn(
          'grid gap-3',
          step.hotspots.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
        )}
      >
        {step.hotspots.map((hotspot) => (
          <KidButton
            key={hotspot.id}
            variant="color"
            color={hotspot.color}
            aria-pressed={selected === hotspot.id}
            onClick={() => pick(hotspot.id)}
            className={cn(
              'relative min-h-20 flex-col gap-1 py-2 text-lg',
              selected === hotspot.id && 'outline-4 outline-offset-2 outline-kid-fg',
            )}
          >
            <span aria-hidden="true" className="text-3xl leading-none">
              {hotspot.icon}
            </span>
            {hotspot.label}
            {seen.has(hotspot.id) && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-kid-surface text-sm shadow-kid-soft"
              >
                ✅
              </span>
            )}
          </KidButton>
        ))}
      </div>
      <SpeechBubble live tail="none">
        {current ? current.message : step.prompt || '👆 Butonlara dokun, keşfet!'}
      </SpeechBubble>
      <p className="sr-only" aria-live="polite">
        {seen.size} / {step.hotspots.length} keşfedildi
      </p>
    </div>
  )
}

export function ToggleSceneBlock({ step, onComplete }: BlockProps<'toggle-scene'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [on, setOn] = useState(false)

  const toggle = () => {
    const next = !on
    setOn(next)
    if (next && complete()) celebrate(step.celebration || step.onMessage || '⭐ Harika!')
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="flex flex-col gap-3 p-3">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state={on ? 'on' : 'off'}
            title={step.title}
            cardColor={step.cardColor}
            emoji={iconEmoji(step)}
          />
        ) : (
          <MissingVisual />
        )}
        {/* The label names the next action ("Işığı Aç!" / "Işığı Kapat"): no aria-pressed. */}
        <KidButton variant="accent" size="lg" onClick={toggle}>
          {on ? step.offLabel : step.onLabel}
        </KidButton>
      </KidPanel>
      <SpeechBubble live tail="none" className="text-center">
        {on ? step.onMessage : null}
      </SpeechBubble>
    </div>
  )
}

export function AnimatedSceneBlock({ step, onComplete }: BlockProps<'animated-scene'>) {
  const complete = useCompleteOnce(onComplete)
  const [paused, setPaused] = useState(false)
  const { reducedMotion } = usePlayer()
  useEffect(() => {
    complete()
  }, [complete])
  const still = paused || reducedMotion
  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="p-3">
        {step.visual ? (
          <VisualArea
            visual={step.visual}
            state="play"
            title={step.title}
            cardColor={step.cardColor}
            emoji={iconEmoji(step)}
            paused={paused}
            onPausedChange={setPaused}
          />
        ) : (
          <MissingVisual />
        )}
      </KidPanel>
      <HintText className={cn(still && '[animation:none]')}>
        {still ? step.staticCaption : step.caption}
      </HintText>
    </div>
  )
}
