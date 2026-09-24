import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { cn } from '@/shared/lib/cn'
import { RichText } from '@/shared/ui'
import { KidButton, KidPanel, SpeechBubble } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { VisualArea } from '../visuals/VisualArea'
import { useCompleteOnce, type BlockProps } from './types'

export function ChooseCorrectBlock({ step, onComplete }: BlockProps<'choose-correct'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [message, setMessage] = useState<string>(step.prompt || '👆 Doğru olanlara dokun!')
  const [wiggle, setWiggle] = useState<{ id: string; key: number } | null>(null)
  const attempts = useRef(0)
  // Clear the wiggle so the next wrong tap restarts the animation.
  useEffect(() => {
    if (!wiggle) return
    const timer = window.setTimeout(() => setWiggle(null), 520)
    return () => window.clearTimeout(timer)
  }, [wiggle])
  const correctIds = step.options.filter((option) => option.correct).map((option) => option.id)
  const solved = correctIds.length > 0 && correctIds.every((id) => picked.has(id))

  const choose = (optionId: string) => {
    const option = step.options.find((candidate) => candidate.id === optionId)
    if (!option || solved) return
    attempts.current++
    if (!option.correct) {
      // A fresh object per wrong tap restarts the wiggle; the attempt count keeps it unique.
      setWiggle({ id: option.id, key: attempts.current })
      setMessage(option.feedback || 'Hmm, bu olmaz! Tekrar dene. 😄')
      return
    }
    const next = new Set(picked).add(option.id)
    setPicked(next)
    if (correctIds.every((id) => next.has(id))) {
      setMessage(step.successMessage || '🎉 Hepsini buldun!')
      if (complete({ attempts: attempts.current })) celebrate(step.celebration || '🎉 Harika!')
    } else {
      setMessage(option.feedback || '✅ Doğru! Devam et.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="flex flex-col gap-4 p-3 pb-5">
        {step.visual && (
          <VisualArea
            visual={step.visual}
            state={solved ? 'success' : 'idle'}
            title={step.title}
            cardColor={step.cardColor}
          />
        )}
        <div
          className={cn(
            'grid gap-3',
            step.options.length > 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3',
          )}
        >
          {step.options.map((option) => {
            const done = picked.has(option.id)
            return (
              <KidButton
                key={option.id}
                variant="color"
                color={option.color}
                aria-pressed={done}
                onClick={() => choose(option.id)}
                className={cn(
                  'relative min-h-20 flex-col gap-1 px-2 py-2 text-lg',
                  wiggle?.id === option.id && 'kid-ambient [animation:kid-wiggle_0.5s_ease-in-out]',
                )}
              >
                <span aria-hidden="true" className="text-3xl leading-none">
                  {option.icon}
                </span>
                {option.label}
                {done && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2.5 -right-2 grid size-8 place-items-center rounded-full bg-kid-success text-base text-white shadow-kid-soft"
                  >
                    ✓
                  </span>
                )}
                {done && <span className="sr-only">(doğru)</span>}
              </KidButton>
            )
          })}
        </div>
      </KidPanel>
      <SpeechBubble live tail="none" className="text-center">
        {message}
      </SpeechBubble>
    </div>
  )
}

export function CompareCardsBlock({ step, onComplete }: BlockProps<'compare-cards'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [picked, setPicked] = useState<string | null>(null)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const current = step.cards.find((card) => card.id === picked)

  const pick = (id: string) => {
    setPicked(id)
    const next = new Set(seen).add(id)
    setSeen(next)
    if (next.size === step.cards.length && complete())
      celebrate(step.celebration || '🎉 Farkı buldun!')
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'grid gap-3',
          step.cards.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2',
        )}
      >
        {step.cards.map((card) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={picked === card.id}
            onClick={() => pick(card.id)}
            data-tone={card.tone}
            className={cn(
              'kid-focus kid-compare-card flex flex-col items-center gap-1.5 rounded-[1.5rem] border-4 p-4 text-center shadow-kid-soft transition-transform duration-150 active:scale-95',
              picked === card.id ? 'border-kid-success' : 'border-transparent',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'text-5xl',
                picked === card.id && 'kid-ambient [animation:kid-sway_1s_ease-in-out_2]',
              )}
            >
              {card.icon}
            </span>
            <span className="text-xl font-bold">{card.title}</span>
            <span className="text-base leading-snug font-medium opacity-90">
              <RichText text={card.text} />
            </span>
            {seen.has(card.id) && <span className="sr-only">(görüldü)</span>}
          </button>
        ))}
      </div>
      <SpeechBubble live tail="none">
        {current ? current.detail : step.prompt || '👆 Kartlara dokun, farkı keşfet!'}
      </SpeechBubble>
    </div>
  )
}

export function QuizBlock({ step, onComplete, onQuizAnswer }: BlockProps<'quiz'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const name = useId()
  const [choice, setChoice] = useState<string | null>(null)
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempts = useRef(0)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!choice || solved) {
      if (!choice) setError('Önce bir cevap seç.')
      return
    }
    setError(null)
    attempts.current++
    const correct = choice === step.correctOptionId
    onQuizAnswer?.({ correct, optionId: choice })
    // The checked radio (wrong) or the whole form (right) becomes disabled: the verdict takes
    // focus, which also reads it out — every time, even when the text repeats.
    focusAfterUpdate(feedbackRef)
    if (correct) {
      setSolved(true)
      if (complete({ attempts: attempts.current })) celebrate(step.celebration || '🎯 Doğru cevap!')
    } else {
      setWrong(new Set(wrong).add(choice))
      setChoice(null)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {step.visual && (
        <KidPanel className="p-3">
          <VisualArea
            visual={step.visual}
            state={solved ? 'success' : 'idle'}
            title={step.title}
            cardColor={step.cardColor}
          />
        </KidPanel>
      )}
      <KidPanel className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-3" disabled={solved}>
          <legend className="mb-3 text-2xl font-bold">{step.question}</legend>
          {step.options.map((option, index) => {
            const isWrong = wrong.has(option.id)
            const isRight = solved && option.id === step.correctOptionId
            return (
              <label
                key={option.id}
                className={cn(
                  'flex min-h-16 cursor-pointer items-center gap-4 rounded-[1.25rem] border-[3px] px-4 py-3 text-xl font-semibold transition-colors',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-kid-focus',
                  isRight
                    ? 'border-kid-success bg-kid-success-bg'
                    : isWrong
                      ? 'cursor-not-allowed border-kid-danger/60 bg-kid-danger-bg opacity-70'
                      : choice === option.id
                        ? 'border-kid-primary bg-kid-surface-2'
                        : 'border-kid-border bg-kid-surface hover:bg-kid-surface-2',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.id}
                  checked={choice === option.id || isRight}
                  disabled={isWrong}
                  onChange={() => setChoice(option.id)}
                  className="size-6 accent-kid-primary"
                />
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-kid-surface-2 text-base font-bold"
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1">{option.label}</span>
                {isRight && <span aria-label="doğru">✅</span>}
                {isWrong && <span aria-label="yanlış">❌</span>}
              </label>
            )
          })}
        </fieldset>
        {!solved && (
          <KidButton type="submit" variant="accent" size="lg">
            Cevabımı kontrol et
          </KidButton>
        )}
        {error && (
          <p role="alert" className="text-center text-lg font-semibold text-kid-danger">
            {error}
          </p>
        )}
      </KidPanel>
      <SpeechBubble
        ref={feedbackRef}
        tabIndex={-1}
        tail="none"
        className={
          solved
            ? 'border-kid-success/60'
            : 'kid-ambient [animation:kid-shake_0.4s_ease-in-out] border-kid-danger/60'
        }
      >
        {solved ? (
          <>✅ Doğru! {step.explanation}</>
        ) : wrong.size > 0 ? (
          'Hmm, bu değil. Bir daha dene! 💪'
        ) : null}
      </SpeechBubble>
    </form>
  )
}
