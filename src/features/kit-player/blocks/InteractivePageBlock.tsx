import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

import { checkPageHtml, type InteractivePageStep, type PageSource } from '@/entities/kit'
import { useDebouncedValue, useOnlineStatus } from '@/shared/hooks/browser-hooks'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { framableOrigin } from '@/shared/lib/framable-origin'
import { HtmlPageFrame, UrlPageFrame, type PageFrameStatus } from '@/shared/ui'
import { HintText, KidButton, KidPanel } from '@/shared/ui/kid'

import { usePlayer } from '../components/usePlayer'
import { useCompleteOnce, type BlockProps } from './types'

const FRAME = 'absolute inset-0 size-full border-0'

/** Studio's live preview gets the page as it is typed: one runner per settled page, not per key. */
const PREVIEW_SETTLE_MS = 700

/** Element fullscreen where the device allows it (not on iPhone): the page fills the screen. */
function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])
  const supported = document.fullscreenEnabled === true
  const toggle = () => {
    // A refused request (no user gesture, a policy) leaves the page as it was: nothing to report.
    if (active) document.exitFullscreen().catch(() => undefined)
    else target.current?.requestFullscreen().catch(() => undefined)
  }
  return { supported, active, toggle }
}

function StageMessage({
  emoji,
  title,
  children,
  action,
}: {
  emoji: string
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-kid-surface-2 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span aria-hidden="true" className="text-5xl">
          {emoji}
        </span>
        <p className="text-lg font-semibold text-kid-fg">{title}</p>
        <p className="text-base text-kid-fg-soft">{children}</p>
        {action}
      </div>
    </div>
  )
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

type PageCardProps = {
  step: InteractivePageStep
  source: PageSource
  explored: boolean
  onExplored: () => void
}

function PageCard({ step, source, explored, onExplored }: PageCardProps) {
  const online = useOnlineStatus()
  const stage = useRef<HTMLDivElement>(null)
  const linkFrame = useRef<HTMLIFrameElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const fullscreen = useFullscreen(stage)
  const [status, setStatus] = useState<PageFrameStatus>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [opened, setOpened] = useState(false)
  const html = source.kind === 'html' ? source.html : ''
  // The page was checked when it was saved; checked again here, since a published snapshot is
  // only as good as the client that wrote it (the third layer after the server and the Studio).
  const pageProblems = useMemo(() => (html ? checkPageHtml(html) : ['empty']), [html])

  const shown =
    source.kind === 'html' ? status.state === 'ready' || status.state === 'error' : opened

  const open = () => {
    setOpened(true)
    // The open button is replaced by the page: focus moves into it (its title is read out).
    focusAfterUpdate(linkFrame)
  }

  const retry = () => {
    setStatus({ state: 'loading' })
    setAttempt((current) => current + 1)
  }

  let content: ReactNode
  if (!online || status.state === 'unavailable') {
    content = (
      <StageMessage
        emoji="📡"
        title="Bu sayfa için internet gerekli"
        action={
          online && (
            <KidButton variant="surface" onClick={retry} className="mt-2">
              🔄 Tekrar dene
            </KidButton>
          )
        }
      >
        Diğer kartlarla devam edebilirsin.
      </StageMessage>
    )
  } else if (status.state === 'blocked') {
    content = (
      <StageMessage emoji="🚧" title="Bu sayfa kapatıldı">
        Sayfa başka bir yere gitmeye çalıştı. Eğitmenine haber verebilirsin.
      </StageMessage>
    )
  } else if (source.kind === 'html' && pageProblems[0] === 'empty') {
    content = (
      <StageMessage emoji="🛠️" title="Sayfa henüz hazır değil">
        Eğitmenin sayfayı hazırlıyor.
      </StageMessage>
    )
  } else if (source.kind === 'html' && pageProblems.length > 0) {
    content = (
      <StageMessage emoji="🚧" title="Bu sayfa burada açılamıyor">
        Eğitmenine haber verebilirsin.
      </StageMessage>
    )
  } else if (source.kind === 'html') {
    content = (
      <>
        <HtmlPageFrame
          key={attempt}
          html={source.html}
          title={step.title}
          className={FRAME}
          onStatus={setStatus}
        />
        {status.state === 'loading' && (
          <output className="absolute inset-0 grid place-items-center bg-kid-night">
            <span className="flex flex-col items-center gap-3 text-lg font-semibold text-white">
              <span aria-hidden="true" className="animate-kid-spin text-4xl">
                🌍
              </span>
              Sayfa hazırlanıyor…
            </span>
          </output>
        )}
      </>
    )
  } else if (!framableOrigin(source.url)) {
    content = (
      <StageMessage emoji="🚧" title="Bu sayfa burada açılamıyor">
        Eğitmenine haber verebilirsin.
      </StageMessage>
    )
  } else if (opened) {
    content = <UrlPageFrame ref={linkFrame} url={source.url} title={step.title} className={FRAME} />
  } else {
    content = (
      // Nothing is requested from the other site until the child taps.
      <button
        type="button"
        data-card-color={step.cardColor}
        onClick={open}
        className="kid-focus kid-color-card group absolute inset-0 flex flex-col items-center justify-center gap-3"
      >
        <span
          aria-hidden="true"
          className="grid size-20 place-items-center rounded-full bg-white/90 text-4xl text-kid-night shadow-kid-soft transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
        >
          🔭
        </span>
        <span className="px-6 text-center text-xl font-bold">Sayfayı aç: {step.title}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {step.instructions && <HintText>{step.instructions}</HintText>}
      <KidPanel className="flex flex-col gap-3 p-3">
        {source.kind === 'url' && (
          // Whose page this is, before and while it shows: another site, not Kâşif.
          <p className="flex min-w-0 items-center gap-2 px-1 text-base text-kid-fg-soft">
            <span aria-hidden="true">🌐</span>
            <span className="truncate">
              <span className="sr-only">Sayfa şu siteden: </span>
              {hostOf(source.url)}
            </span>
          </p>
        )}
        <div
          ref={stage}
          className="relative aspect-[4/3] max-h-[70dvh] w-full overflow-hidden rounded-[1.25rem] bg-kid-night"
        >
          {content}
          {fullscreen.active && (
            <KidButton
              variant="surface"
              onClick={fullscreen.toggle}
              className="absolute top-3 right-3"
            >
              ✖ Tam ekrandan çık
            </KidButton>
          )}
        </div>
        {shown && online && fullscreen.supported && (
          <KidButton variant="surface" onClick={fullscreen.toggle} className="self-start">
            ⛶ Tam ekran
          </KidButton>
        )}
      </KidPanel>
      {status.state === 'error' && online && (
        <output className="block text-center text-base text-kid-fg-soft">
          Bu sayfa bu cihazda tam çalışmayabilir. Yine de keşfetmeyi dene!
        </output>
      )}
      {shown && online && (
        // aria-disabled keeps focus on the button once pressed; its label then states the result.
        <KidButton
          variant={explored ? 'surface' : 'accent'}
          onClick={onExplored}
          aria-disabled={explored}
          className="self-center"
        >
          {explored ? '✅ Keşfettin!' : '🔭 Keşfettim'}
        </KidButton>
      )}
    </div>
  )
}

/**
 * Interactive page card (ADR 0023): an HTML page in the page runner, or a linked page loaded only
 * after a tap (privacy and data use, like YouTube). Completes with "Keşfettim" once it is shown.
 * A changed page (Studio's live preview) starts over with a fresh frame and state.
 */
export function InteractivePageBlock({ step, onComplete }: BlockProps<'interactive-page'>) {
  const { celebrate, mode } = usePlayer()
  const complete = useCompleteOnce(onComplete)
  const [explored, setExplored] = useState(false)
  const source = useDebouncedValue(step.source, mode === 'preview' ? PREVIEW_SETTLE_MS : 0)

  const onExplored = () => {
    if (explored) return
    setExplored(true)
    if (complete()) celebrate(step.celebration || '🌍 Harika keşif!')
  }

  return (
    <PageCard
      key={source.kind === 'html' ? source.html : source.url}
      step={step}
      source={source}
      explored={explored}
      onExplored={onExplored}
    />
  )
}
