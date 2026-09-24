import { useMemo, useRef, useState } from 'react'

import { shuffleStable } from '@/entities/kit'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { cn } from '@/shared/lib/cn'
import { KidButton, KidPanel, SpeechBubble } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { useCompleteOnce, type BlockProps } from './types'

/**
 * Sequence (F5.8): tap one card, then the card to swap it with — or use the ▲/▼ buttons.
 * Works with touch, keyboard and screen readers; drag and drop is not required.
 */
export function SequenceBlock({ step, onComplete }: BlockProps<'sequence'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [order, setOrder] = useState(() =>
    shuffleStable(
      step.items.map((item) => item.id),
      step.id,
    ),
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<'idle' | 'wrong' | 'right'>('idle')
  const [announcement, setAnnouncement] = useState('')
  const attempts = useRef(0)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const byId = useMemo(() => new Map(step.items.map((item) => [item.id, item])), [step.items])
  const correctOrder = step.items.map((item) => item.id)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || result === 'right') return
    const next = [...order]
    const a = next[from]
    const b = next[to]
    if (a === undefined || b === undefined) return
    next[from] = b
    next[to] = a
    // Reordering moves the list items in the DOM, which drops focus: keep it on the control
    // the child just used, so ▲/▼ can be pressed again right away.
    const pressed = document.activeElement
    if (pressed instanceof HTMLElement) focusAfterUpdate(() => pressed)
    setOrder(next)
    setResult('idle')
    setAnnouncement(`${byId.get(a)?.label ?? ''} ${to + 1}. sıraya taşındı.`)
  }

  const tap = (id: string) => {
    if (result === 'right') return
    if (selected === null) {
      setSelected(id)
      setAnnouncement(
        `${byId.get(id)?.label ?? ''} seçildi. Yerini değiştirmek için başka bir karta dokun.`,
      )
      return
    }
    if (selected !== id) move(order.indexOf(selected), order.indexOf(id))
    setSelected(null)
  }

  const check = () => {
    if (result === 'right') return
    attempts.current++
    const right = order.every((id, index) => id === correctOrder[index])
    setResult(right ? 'right' : 'wrong')
    setSelected(null)
    // The button goes away once the order is right: the verdict takes focus (and is read out).
    focusAfterUpdate(feedbackRef)
    if (right && complete({ attempts: attempts.current }))
      celebrate(step.celebration || '🎉 Sıralama doğru!')
  }

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="flex flex-col gap-4">
        <p className="text-xl font-semibold">{step.prompt}</p>
        <ol className="flex flex-col gap-3" aria-label="Sıralanacak kartlar">
          {order.map((id, index) => {
            const item = byId.get(id)
            if (!item) return null
            const inPlace = result !== 'idle' && correctOrder[index] === id
            return (
              <li key={id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-kid-surface-2 text-lg font-bold tabular"
                >
                  {index + 1}
                </span>
                <button
                  type="button"
                  aria-pressed={selected === id}
                  onClick={() => tap(id)}
                  className={cn(
                    'kid-focus flex min-h-16 flex-1 items-center gap-3 rounded-[1.25rem] border-[3px] bg-kid-surface px-4 text-left text-xl font-semibold shadow-kid-soft transition-[transform,border-color] duration-150 active:scale-[0.98]',
                    selected === id ? 'border-kid-primary bg-kid-surface-2' : 'border-kid-border',
                    result === 'right' && 'border-kid-success',
                    result === 'wrong' && !inPlace && 'border-kid-danger/70',
                  )}
                >
                  <span aria-hidden="true" className="text-3xl">
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {result !== 'idle' && (
                    <span aria-label={inPlace ? 'doğru yerde' : 'yanlış yerde'}>
                      {inPlace ? '✅' : '↕️'}
                    </span>
                  )}
                </button>
                {/* aria-disabled, not disabled: the arrow just pressed keeps focus at the ends. */}
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    aria-disabled={index === 0 || result === 'right'}
                    aria-label={`${item.label} yukarı taşı`}
                    className="kid-focus grid size-9 place-items-center rounded-xl bg-kid-surface-2 text-base aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    aria-disabled={index === order.length - 1 || result === 'right'}
                    aria-label={`${item.label} aşağı taşı`}
                    className="kid-focus grid size-9 place-items-center rounded-xl bg-kid-surface-2 text-base aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
        {result !== 'right' && (
          <KidButton variant="accent" size="lg" onClick={check}>
            Sıramı kontrol et
          </KidButton>
        )}
      </KidPanel>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <SpeechBubble
        ref={feedbackRef}
        tabIndex={-1}
        tail="none"
        className={cn('text-center', result === 'right' && 'border-kid-success/60')}
      >
        {result === 'right'
          ? step.successMessage || '🎉 Sıralama doğru!'
          : result === 'wrong'
            ? 'Neredeyse! ✅ olanlar doğru yerde; diğerlerinin yerini değiştir. 💪'
            : null}
      </SpeechBubble>
    </div>
  )
}

const PAIR_COLORS = ['green', 'sky', 'purple', 'orange', 'pink'] as const

/** Matching: tap a word on the left, then its partner on the right. */
export function MatchingBlock({ step, onComplete }: BlockProps<'matching'>) {
  const { celebrate } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const rights = useMemo(
    () =>
      shuffleStable(
        step.pairs.map((pair) => pair.id),
        `${step.id}:r`,
      ),
    [step.id, step.pairs],
  )
  const [left, setLeft] = useState<string | null>(null)
  const [matched, setMatched] = useState<readonly string[]>([])
  const [message, setMessage] = useState(step.prompt || '👆 Soldan bir karta, sonra eşine dokun!')
  const [shake, setShake] = useState<string | null>(null)
  const attempts = useRef(0)
  const byId = useMemo(() => new Map(step.pairs.map((pair) => [pair.id, pair])), [step.pairs])
  const done = matched.length === step.pairs.length && step.pairs.length > 0

  const pickRight = (id: string) => {
    if (done || matched.includes(id)) return
    if (!left) {
      setMessage('Önce soldan bir kart seç. 👈')
      return
    }
    attempts.current++
    if (left === id) {
      const next = [...matched, id]
      setMatched(next)
      setLeft(null)
      const pair = byId.get(id)
      if (next.length === step.pairs.length) {
        setMessage(step.successMessage || '🎉 Tüm eşleri buldun!')
        if (complete({ attempts: attempts.current }))
          celebrate(step.celebration || '🔗 Harika eşleştirme!')
      } else {
        setMessage(`✅ ${pair?.left ?? ''} → ${pair?.right ?? ''}. Devam!`)
      }
    } else {
      setShake(id)
      window.setTimeout(() => setShake(null), 450)
      setMessage('Bu ikisi eş değil. Tekrar dene! 😊')
    }
  }

  const colorOf = (id: string) => PAIR_COLORS[matched.indexOf(id) % PAIR_COLORS.length] ?? 'green'

  return (
    <div className="flex flex-col gap-3">
      <KidPanel className="grid grid-cols-2 gap-3 sm:gap-5">
        <ul className="flex flex-col gap-3" aria-label="Sol kartlar">
          {step.pairs.map((pair) => {
            const isMatched = matched.includes(pair.id)
            return (
              <li key={pair.id}>
                {/* Matched cards are aria-disabled, not disabled, so focus never drops. */}
                <KidButton
                  variant={isMatched ? 'color' : 'surface'}
                  color={isMatched ? colorOf(pair.id) : undefined}
                  aria-pressed={left === pair.id}
                  aria-disabled={isMatched}
                  onClick={() => {
                    if (!isMatched) setLeft(left === pair.id ? null : pair.id)
                  }}
                  className={cn(
                    'w-full text-lg aria-disabled:cursor-default aria-disabled:opacity-100',
                    left === pair.id && 'ring-4 ring-kid-primary',
                  )}
                >
                  {pair.left}
                  {isMatched && <span className="sr-only"> (eşleşti)</span>}
                </KidButton>
              </li>
            )
          })}
        </ul>
        <ul className="flex flex-col gap-3" aria-label="Sağ kartlar">
          {rights.map((id) => {
            const pair = byId.get(id)
            if (!pair) return null
            const isMatched = matched.includes(id)
            return (
              <li key={id}>
                <KidButton
                  variant={isMatched ? 'color' : 'surface'}
                  color={isMatched ? colorOf(id) : undefined}
                  aria-disabled={isMatched}
                  onClick={() => pickRight(id)}
                  className={cn(
                    'w-full text-lg aria-disabled:cursor-default aria-disabled:opacity-100',
                    shake === id && 'kid-ambient [animation:kid-shake_0.4s_ease-in-out]',
                  )}
                >
                  {pair.right}
                  {isMatched && <span className="sr-only"> (eşleşti)</span>}
                </KidButton>
              </li>
            )
          })}
        </ul>
      </KidPanel>
      <SpeechBubble live tail="none" className="text-center">
        {message}
      </SpeechBubble>
    </div>
  )
}
