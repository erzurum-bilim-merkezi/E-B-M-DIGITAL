import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { KitDocument, Step } from '@/entities/kit'
import { cn } from '@/shared/lib/cn'
import { RichText, richTextToPlain } from '@/shared/ui'
import { HintText, KidIconButton, KidPanel, SpeakButton, StepChip } from '@/shared/ui/kid'
import { useResolvedMediaUrl } from '@/shared/hooks/useResolvedMediaUrl'

import { StepRenderer } from '../blocks/registry'
import type { BlockCompletion } from '../blocks/types'
import { KitIcon } from './KitIcon'
import { usePlayer } from './usePlayer'

/** Link for kids routes or a callback (Studio preview navigates in place). */
export type NavTarget = { to: string } | { onClick: () => void }

type StepShellProps = {
  kit: KitDocument
  step: Step
  index: number
  /**
   * QR entry in "Her kart kendi QR'ı ile" mode (R2): only this card, no kit navigation. Once the
   * card is done the child is asked to scan the next card's QR.
   */
  focused: boolean
  nav: {
    home: NavTarget
    /** The next card to play ("Sıradaki kart"); absent when no other card is left. */
    next?: NavTarget | undefined
    /** The completion page, offered once the kit is complete. */
    finish?: NavTarget | undefined
    allCards?: NavTarget | undefined
    /** Focused mode: the QR scanner for the next card. */
    scanNext?: NavTarget | undefined
  }
  completed: boolean
  /** Every required card is done (this one included): offer the completion page. */
  kitDone?: boolean
  /** Required cards done / total, shown after a card in focused mode. */
  progress?: { done: number; total: number } | undefined
  onStepComplete: (meta: BlockCompletion) => void
  onQuizAnswer?: (answer: { correct: boolean; optionId: string }) => void
  /** Extra content under the answer (e.g. preview banner). */
  footer?: ReactNode
  /** Move focus to the question on card change (off in the Studio side preview). */
  autoFocus?: boolean
}

function NavButton({
  target,
  className,
  children,
  label,
}: {
  target: NavTarget
  className?: string
  children: ReactNode
  label?: string
}) {
  const classes = cn(
    'kid-focus inline-flex min-h-16 flex-1 items-center justify-center gap-2 rounded-[1.375rem] px-6 text-xl font-bold select-none',
    'transition-[transform,box-shadow] duration-150 active:translate-y-1',
    className,
  )
  if ('to' in target) {
    return (
      <Link to={target.to} className={classes} aria-label={label}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={target.onClick} className={classes} aria-label={label}>
      {children}
    </button>
  )
}

const PRIMARY = 'bg-kid-accent text-kid-accent-fg shadow-kid-3d-accent'
const SECONDARY = 'bg-kid-surface text-kid-fg shadow-kid-soft ring-2 ring-kid-border'

function narrationFor(step: Step) {
  const base = step.narration.trim() || `${step.title}. ${richTextToPlain(step.answer)}`
  return base.trim()
}

/**
 * One card (E-B-M "soru" page): 🏠 · "Kart 3 / 7" · 🔊 Dinle, the question as h1, the block,
 * the hint, the answer box and "Sıradaki kart" / "Bitirdim!".
 */
export function StepShell({
  kit,
  step,
  index,
  focused,
  nav,
  completed,
  kitDone = false,
  progress,
  onStepComplete,
  onQuizAnswer,
  footer,
  autoFocus = true,
}: StepShellProps) {
  const { muted } = usePlayer()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const audioUrl = useResolvedMediaUrl(step.audio?.url)
  const total = kit.steps.length

  // Move focus to the new question on navigation (screen readers announce it).
  useEffect(
    () => {
      if (!autoFocus) return
      headingRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0 })
    },
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- step.id is the trigger: refocus on every card change
    [autoFocus, step.id],
  )

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 motion-safe:animate-[kid-pop_0.45s_cubic-bezier(.2,1.4,.4,1)]">
      {/* Wraps instead of overflowing at 320 px or with large text (WCAG 1.4.10). */}
      <div className="flex flex-wrap items-center gap-3">
        {!focused &&
          ('to' in nav.home ? (
            <Link
              to={nav.home.to}
              aria-label="Kitin ana sayfası"
              className="kid-focus grid size-14 shrink-0 place-items-center rounded-[1.25rem] bg-kid-surface text-2xl shadow-kid-soft transition-transform active:scale-90"
            >
              <span aria-hidden="true">🏠</span>
            </Link>
          ) : (
            <KidIconButton label="Kitin ana sayfası" onClick={nav.home.onClick}>
              🏠
            </KidIconButton>
          ))}
        <StepChip>
          Kart {index + 1} / {total}
          {completed && (
            <span className="ml-2" aria-label="tamamlandı">
              ✅
            </span>
          )}
        </StepChip>
        <SpeakButton
          text={narrationFor(step)}
          audioUrl={audioUrl ?? null}
          muted={muted}
          className="ml-auto"
        />
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mx-1 mt-1 flex items-start gap-3 text-[clamp(1.6rem,5.5vw,2.3rem)] leading-tight font-bold text-balance outline-none"
      >
        <KitIcon icon={step.icon} className="shrink-0 text-[1.15em]" />
        <span>{step.title}</span>
      </h1>

      <StepRenderer
        key={step.id}
        step={step}
        onComplete={onStepComplete}
        onQuizAnswer={onQuizAnswer}
      />

      {/* The hint tells what to do; once the card is done it only adds noise. */}
      {step.hint && !completed && <HintText>{step.hint}</HintText>}

      {step.answer.trim() && (
        <KidPanel
          as="section"
          aria-label="Cevap"
          className="text-[clamp(1.1rem,4vw,1.35rem)] leading-relaxed font-medium"
        >
          <RichText text={step.answer} strongClassName="text-kid-success" />
        </KidPanel>
      )}

      {footer}

      {focused && completed && !kitDone && progress && (
        <p className="text-center text-lg font-semibold text-kid-fg-soft">
          Harika! {progress.done} / {progress.total} kart tamamlandı. Sıradaki kartın QR kodunu bul.
        </p>
      )}

      <nav aria-label="Kart gezinmesi" className="mt-2 flex flex-wrap gap-3 pb-4">
        {focused ? (
          <>
            {kitDone && nav.finish ? (
              <NavButton target={nav.finish} className={PRIMARY}>
                🎉 Kiti bitirdin!
              </NavButton>
            ) : (
              completed &&
              nav.scanNext && (
                <NavButton target={nav.scanNext} className={PRIMARY}>
                  📷 Sıradaki kartın QR'ını okut
                </NavButton>
              )
            )}
            {nav.allCards && (
              <NavButton target={nav.allCards} className={SECONDARY}>
                🗂️ Bu kitteki diğer kartlar
              </NavButton>
            )}
          </>
        ) : kitDone && nav.finish ? (
          <>
            {nav.next ? (
              <NavButton target={nav.next} className={SECONDARY}>
                Sıradaki kart ➜
              </NavButton>
            ) : (
              <NavButton target={nav.home} className={SECONDARY}>
                🏠 Kitin ana sayfası
              </NavButton>
            )}
            <NavButton target={nav.finish} className={PRIMARY}>
              🎉 Bitirdim!
            </NavButton>
          </>
        ) : nav.next ? (
          <NavButton target={nav.next} className={PRIMARY}>
            Sıradaki kart ➜
          </NavButton>
        ) : (
          <NavButton target={nav.home} className={SECONDARY}>
            🏠 Kitin ana sayfası
          </NavButton>
        )}
      </nav>
    </article>
  )
}
