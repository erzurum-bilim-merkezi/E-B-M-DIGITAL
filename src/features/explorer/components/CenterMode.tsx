import { useEffect, useRef, useState, type FormEvent } from 'react'

import { errorMessage } from '@/shared/api/errors'
import { useIdleTimer, useWakeLock } from '@/shared/hooks/browser-hooks'
import { useFocusAfterUpdate, useFocusTrap } from '@/shared/hooks/focus-hooks'
import { KidButton, KidInput, KidPanel, Mascot } from '@/shared/ui/kid'

import { explorerService } from '../api'
import { useActiveExplorer, useHandOverDevice } from '../api/queries'
import { useCenterDevice } from '../hooks/useCenterDevice'
import { ExplorerCard } from './ExplorerCard'

/** Centre tablets hand over to the next visitor after 90 s of inactivity (+20 s warning). */
export const CENTER_IDLE_MS = 90_000
/** WCAG 2.2.1: at least 20 seconds to answer "Hâlâ orada mısın?" with a single tap. */
export const CENTER_WARNING_SECONDS = 20

/**
 * Kiosk behaviour for centre devices (F13.6): keeps the screen on, asks "Hâlâ orada mısın?"
 * after 90 s idle, then shows the Kâşif card and returns to the welcome screen for the next
 * child (every member is unlinked from this device and its codes are forgotten; they continue
 * at home by code).
 */
export function CenterModeGuard({ onHandOver }: { onHandOver: () => void }) {
  const device = useCenterDevice()
  const { explorer } = useActiveExplorer()
  const handOver = useHandOverDevice()
  const [phase, setPhase] = useState<'none' | 'warning' | 'card'>('none')
  const [seconds, setSeconds] = useState(CENTER_WARNING_SECONDS)
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const active = device !== null && explorer !== null

  useWakeLock(device !== null)
  useIdleTimer(
    CENTER_IDLE_MS,
    () => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setSeconds(CENTER_WARNING_SECONDS)
      setPhase('warning')
    },
    active && phase === 'none',
  )

  // Counts down against a deadline, so a sleeping tablet (throttled timers) still hands over on
  // time when it wakes up.
  useEffect(() => {
    if (phase !== 'warning') return
    const deadline = Date.now() + CENTER_WARNING_SECONDS * 1000
    const timer = window.setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000)
      if (left <= 0) setPhase('card')
      else setSeconds(left)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  // Modal: its primary button takes focus when it opens or changes, and Tab stays inside.
  useEffect(() => {
    if (phase !== 'none') primaryButton.current?.focus()
  }, [phase])
  useFocusTrap(dialogRef, active && phase !== 'none')

  if (!active || phase === 'none') return null

  const stay = () => {
    setPhase('none')
    // Back to where the child was before the warning covered the screen.
    const previous = returnFocus.current
    if (previous?.isConnected) focusAfterUpdate(() => previous)
  }

  const finish = () => {
    handOver.mutate()
    setPhase('none')
    onHandOver()
  }

  return (
    <div
      ref={dialogRef}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- kiosk overlay rendered only while active; a native <dialog> needs showModal() and would change its focus and Escape behaviour
      role="dialog"
      aria-modal="true"
      aria-labelledby="center-dialog-title"
      aria-describedby="center-dialog-description"
      className="fixed inset-0 z-50 grid place-items-center bg-kid-night/70 p-4 backdrop-blur-sm"
    >
      <KidPanel className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        {phase === 'warning' ? (
          <>
            <Mascot color={explorer?.avatar ?? 'indigo'} pose="thinking" className="size-28" />
            <h2 id="center-dialog-title" className="text-3xl font-bold">
              Hâlâ orada mısın?
            </h2>
            {/* Read once with the dialog, not every second (no live region). */}
            <p id="center-dialog-description" className="text-xl text-kid-fg-soft">
              {seconds} saniye içinde sıradaki kâşife geçeceğiz.
            </p>
            <KidButton ref={primaryButton} size="xl" className="w-full" onClick={stay}>
              Buradayım! 👋
            </KidButton>
          </>
        ) : (
          explorer && (
            <>
              <h2 id="center-dialog-title" className="text-2xl font-bold">
                Görüşmek üzere {explorer.nickname}! 👋
              </h2>
              <p id="center-dialog-description" className="text-lg text-kid-fg-soft">
                Kâşif kodunla evde ya da başka bir cihazda kaldığın yerden devam edebilirsin.
              </p>
              <ExplorerCard explorer={explorer} actions={false} />
              <KidButton ref={primaryButton} size="xl" className="w-full" onClick={finish}>
                Sıradaki kâşif ➜
              </KidButton>
            </>
          )
        )}
      </KidPanel>
    </div>
  )
}

/** "Merkez cihazı kur": activates kiosk mode with a single-use setup code from Studio. */
export function CenterDeviceSetup({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await explorerService.activateCenterDevice(code)
      onActivated()
    } catch (error) {
      setProblem(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <label htmlFor="center-code" className="text-lg font-bold">
        Kurulum kodu (Studio → Ayarlar)
      </label>
      <KidInput
        id="center-code"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        autoComplete="off"
        className="font-mono tracking-widest"
        aria-describedby="center-code-error"
        aria-invalid={problem ? true : undefined}
      />
      <p id="center-code-error" role="alert" className="min-h-6 font-semibold text-kid-danger">
        {problem}
      </p>
      <KidButton type="submit" disabled={busy || code.trim().length < 6}>
        Merkez cihazı olarak kur
      </KidButton>
    </form>
  )
}

/** Leaving kiosk mode needs the educator PIN. */
export function CenterDeviceExit({ onExited }: { onExited: () => void }) {
  const [pin, setPin] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await explorerService.exitCenterMode(pin)
      onExited()
    } catch (error) {
      setProblem(errorMessage(error))
      setPin('')
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <label htmlFor="center-pin" className="text-lg font-bold">
        Eğitmen PIN’i
      </label>
      <KidInput
        id="center-pin"
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        aria-describedby="center-pin-error"
        aria-invalid={problem ? true : undefined}
      />
      <p id="center-pin-error" role="alert" className="min-h-6 font-semibold text-kid-danger">
        {problem}
      </p>
      <KidButton type="submit" variant="surface" disabled={pin.length < 4}>
        Merkez modundan çık
      </KidButton>
    </form>
  )
}
