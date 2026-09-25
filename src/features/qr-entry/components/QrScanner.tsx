import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { cn } from '@/shared/lib/cn'
import { KidButton, Mascot } from '@/shared/ui/kid'

import { useQrCamera } from '../hooks/useQrCamera'
import { hasCameraSupport, watchCameraPermission, type CameraProblem } from '../lib/camera'

export type QrScannerProps = {
  /** Raw text of every newly seen QR code; the same value is ignored while it stays in view. */
  onDetected: (text: string) => void
  /** Turns the camera off (e.g. while the page handles a result); it restarts when unpaused. */
  paused?: boolean
  className?: string
}

/** The same code seen again within this window is the same scan, not a new one. */
const REPEAT_WINDOW_MS = 2000

const SCAN_LINE_KEYFRAMES =
  '@keyframes kasif-qr-scan{from{transform:translateY(-100%)}to{transform:translateY(0)}}'

const PROBLEMS: Record<
  CameraProblem,
  { icon: string; message: string; hint: string; canRetry: boolean }
> = {
  denied: {
    icon: '🙈',
    message: 'Kamera izni verilmedi. Kodu elle yazabilirsin.',
    hint: 'Tarayıcı bu kararı hatırlıyor, izin sorusu bir daha çıkmaz. Bir büyüğünden kamerayı ayarlardan açmasını iste; açılınca kamera kendiliğinden başlar.',
    canRetry: true,
  },
  'not-found': {
    icon: '📷',
    message: 'Bu cihazda kamera bulunamadı.',
    hint: 'Etiketin altındaki kodu elle yazabilirsin.',
    canRetry: false,
  },
  failed: {
    icon: '😕',
    message: 'Kamera açılamadı.',
    hint: 'Başka bir uygulama kamerayı kullanıyor olabilir. Tekrar dene ya da kodu elle yaz.',
    canRetry: true,
  },
}

const VIEWFINDER_CORNERS = [
  'top-0 left-0 rounded-tl-[1.25rem] border-t-[6px] border-l-[6px]',
  'top-0 right-0 rounded-tr-[1.25rem] border-t-[6px] border-r-[6px]',
  'bottom-0 left-0 rounded-bl-[1.25rem] border-b-[6px] border-l-[6px]',
  'right-0 bottom-0 rounded-br-[1.25rem] border-r-[6px] border-b-[6px]',
] as const

/** When the focused button was replaced by this view, keep keyboard focus inside it. */
function useFocusIfLost(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) ref.current?.focus({ preventScroll: true })
  }, [ref])
}

function Intro({ onOpen, focusOnMount }: { onOpen: () => void; focusOnMount: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusOnMount) buttonRef.current?.focus()
  }, [focusOnMount])

  return (
    <>
      <Mascot pose="hello" className="size-24" />
      <p className="max-w-sm text-xl font-semibold text-balance text-kid-fg">
        Kâşif, QR kodu görmek için kamerayı kullanır. Görüntü kaydedilmez.
      </p>
      <KidButton ref={buttonRef} size="xl" onClick={onOpen}>
        <span aria-hidden="true">📷</span>
        Kamerayı aç
      </KidButton>
    </>
  )
}

/** Where to switch the camera back on, for the adult helping (the prompt never reappears). */
const PERMISSION_STEPS = [
  {
    where: 'Tarayıcıda',
    how: 'Adres çubuğundaki kilit ya da ayar simgesi → İzinler → Kamera → İzin ver',
  },
  {
    where: 'Yüklü uygulamada',
    how: 'Kâşif simgesine basılı tut → Uygulama bilgisi → İzinler (ya da Site ayarları) → Kamera → İzin ver',
  },
  {
    where: 'Hâlâ olmuyorsa',
    how: 'Cihaz Ayarları → Uygulamalar → tarayıcı (Chrome ya da Safari) → İzinler → Kamera → İzin ver',
  },
] as const

function PermissionSteps() {
  return (
    <details className="w-full max-w-sm rounded-kid bg-kid-surface-2 px-4 py-3 text-left">
      <summary className="cursor-pointer text-base font-semibold text-kid-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kid-sun">
        Kamera izni nasıl açılır?
      </summary>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-base text-kid-fg-soft">
        {PERMISSION_STEPS.map(({ where, how }) => (
          <li key={where}>
            <span className="font-semibold text-kid-fg">{where}:</span> {how}
          </li>
        ))}
      </ol>
    </details>
  )
}

function ProblemNotice({ problem, onRetry }: { problem: CameraProblem; onRetry?: () => void }) {
  const { icon, message, hint, canRetry } = PROBLEMS[problem]
  return (
    <div className="flex flex-col items-center gap-3">
      <span aria-hidden="true" className="text-5xl leading-none">
        {icon}
      </span>
      <p role="alert" className="text-xl font-semibold text-balance text-kid-fg">
        {message}
      </p>
      <p className="max-w-sm text-base text-balance text-kid-fg-soft">{hint}</p>
      {problem === 'denied' && <PermissionSteps />}
      {canRetry && onRetry && (
        <KidButton variant="surface" onClick={onRetry}>
          Tekrar dene
        </KidButton>
      )}
    </div>
  )
}

function FocusableView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusIfLost(ref)
  return (
    <div ref={ref} tabIndex={-1} className={cn('outline-none', className)}>
      {children}
    </div>
  )
}

function Viewfinder({ scanning }: { scanning: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-[14%]">
      {VIEWFINDER_CORNERS.map((corner) => (
        <span key={corner} className={cn('absolute size-12 border-kid-sun', corner)} />
      ))}
      {scanning && (
        <div className="absolute inset-x-3 inset-y-0 overflow-hidden">
          <div className="kid-ambient absolute inset-0 motion-safe:animate-[kasif-qr-scan_2.4s_ease-in-out_infinite_alternate] motion-reduce:hidden">
            <div className="absolute inset-x-0 bottom-0 h-1.5 rounded-full bg-kid-sun" />
          </div>
        </div>
      )}
    </div>
  )
}

function CameraSession({
  onDetected,
  onRetry,
  onClose,
}: {
  onDetected: (text: string) => void
  onRetry: () => void
  onClose: () => void
}) {
  const { videoRef, status, torch, toggleTorch } = useQrCamera(onDetected)
  const problem = status === 'starting' || status === 'scanning' ? null : status
  const scanning = status === 'scanning'

  // A blocked camera cannot be asked for again: start as soon as it is allowed in settings.
  useEffect(
    () => (problem === 'denied' ? watchCameraPermission(onRetry) : undefined),
    [problem, onRetry],
  )

  if (problem) {
    return (
      <FocusableView className="w-full">
        <ProblemNotice problem={problem} onRetry={onRetry} />
      </FocusableView>
    )
  }

  return (
    <FocusableView className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-[26rem] overflow-hidden rounded-kid bg-kid-night shadow-kid-card">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Kamera görüntüsü"
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-300',
            scanning ? 'opacity-100' : 'opacity-0',
          )}
        />
        {!scanning && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center text-5xl motion-safe:animate-pulse"
          >
            📷
          </span>
        )}
        <Viewfinder scanning={scanning} />
      </div>
      <output className="text-lg font-semibold text-kid-fg">
        {scanning ? 'QR kodu çerçevenin içine getir.' : 'Kamera açılıyor…'}
      </output>
      <div className="flex flex-wrap justify-center gap-3">
        {torch !== 'unsupported' && (
          <KidButton
            variant="surface"
            aria-pressed={torch === 'on'}
            onClick={() => void toggleTorch()}
          >
            <span aria-hidden="true">🔦</span>
            Fener
          </KidButton>
        )}
        <KidButton variant="surface" onClick={onClose}>
          Kamerayı kapat
        </KidButton>
      </div>
    </FocusableView>
  )
}

/**
 * In-app QR scanner for children. Explains why the camera is needed and opens it only after a
 * tap; reads codes with `BarcodeDetector` or jsQR; stops the camera when closed, paused or
 * unmounted. Camera problems are shown as friendly messages — it never throws.
 */
export function QrScanner({ onDetected, paused = false, className }: QrScannerProps) {
  const [view, setView] = useState<'intro' | 'camera' | 'no-camera'>('intro')
  const [attempt, setAttempt] = useState(0)
  const [focusIntro, setFocusIntro] = useState(false)
  const onDetectedRef = useRef(onDetected)
  const lastSeenRef = useRef<{ value: string; at: number } | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  const report = useCallback((value: string) => {
    const now = performance.now()
    const last = lastSeenRef.current
    lastSeenRef.current = { value, at: now }
    if (last && last.value === value && now - last.at < REPEAT_WINDOW_MS) return
    onDetectedRef.current(value)
  }, [])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  const open = () => setView(hasCameraSupport() ? 'camera' : 'no-camera')
  const close = () => {
    setView('intro')
    setFocusIntro(true)
  }

  return (
    <div className={cn('flex w-full flex-col items-center gap-5 text-center', className)}>
      <style>{SCAN_LINE_KEYFRAMES}</style>
      {view === 'intro' && <Intro onOpen={open} focusOnMount={focusIntro} />}
      {view === 'no-camera' && (
        <FocusableView className="w-full">
          <ProblemNotice problem="not-found" />
        </FocusableView>
      )}
      {view === 'camera' &&
        (paused ? (
          <FocusableView className="grid aspect-square w-full max-w-[26rem] place-items-center rounded-kid bg-kid-surface-2">
            <output className="text-lg font-semibold text-kid-fg-soft">Kamera bekliyor…</output>
          </FocusableView>
        ) : (
          <CameraSession key={attempt} onDetected={report} onRetry={retry} onClose={close} />
        ))}
    </div>
  )
}
