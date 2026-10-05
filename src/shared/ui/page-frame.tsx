import { useQuery } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useRef, useState, type Ref } from 'react'
import { z } from 'zod'

import { pageRunnerUrl, pageRuntimeQueryOptions } from '@/shared/api/page-runtime'
import { PAGE_MESSAGES } from '@/shared/config/page-runner'
import { framableOrigin } from '@/shared/lib/framable-origin'

/*
 * Frames of interactive pages (ADR 0023). They speak to the page and report its state; the caller
 * draws loading, error and offline states in its own look (Kâşif or Studio).
 */

/**
 * The page runner gets scripts only — never `allow-same-origin`: the page runs with an opaque
 * origin and cannot read this app's storage; no popups, forms, top navigation or downloads.
 */
export const HTML_PAGE_SANDBOX = 'allow-scripts'

/**
 * A linked page of another site keeps its own origin (most sites need it to run) but cannot open
 * windows, submit forms or take the child away from Kâşif.
 */
export const URL_PAGE_SANDBOX = 'allow-scripts allow-same-origin'

export type PageFrameStatus =
  | { state: 'loading' }
  | { state: 'ready' }
  /** The page threw (no WebGL, a bug): it may still be partly usable. */
  | { state: 'error'; message: string }
  /** The runtime could not be fetched (offline). */
  | { state: 'unavailable' }
  /** The page sent its frame to another address: the frame was removed. */
  | { state: 'blocked' }

/** Anything from the frame is untrusted: only these shapes are read. */
const pageMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(PAGE_MESSAGES.ready) }),
  z.object({ type: z.literal(PAGE_MESSAGES.loaded) }),
  z.object({ type: z.literal(PAGE_MESSAGES.error), message: z.string().max(300).catch('') }),
])

/** A page that never reports `loaded` (it failed before the event) is shown after this anyway. */
const READY_FALLBACK_MS = 6000
/** A runner that never says it is ready did not load (a Wi‑Fi without internet, a portal). */
const RUNNER_TIMEOUT_MS = 20_000

type HtmlPageFrameProps = {
  html: string
  /** Accessible name of the frame. */
  title: string
  className?: string
  onStatus?: (status: PageFrameStatus) => void
}

function RunnerFrame({ html, title, className, onStatus }: HtmlPageFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const runtime = useQuery(pageRuntimeQueryOptions())
  const [runnerReady, setRunnerReady] = useState(false)
  const [left, setLeft] = useState(false)
  const loads = useRef(0)
  const last = useRef<PageFrameStatus['state'] | null>(null)
  // `ready` only ends `loading`: an error the page threw before its load event, a page that was
  // closed or a runner that never came stay what they are.
  const report = useEffectEvent((status: PageFrameStatus) => {
    if (status.state === 'ready' && last.current !== 'loading') return
    last.current = status.state
    onStatus?.(status)
  })

  useEffect(() => {
    report({ state: 'loading' })
    const listener = (event: MessageEvent) => {
      const source = frame.current?.contentWindow
      if (!source || event.source !== source) return
      const message = pageMessageSchema.safeParse(event.data)
      if (!message.success) return
      if (message.data.type === PAGE_MESSAGES.ready) setRunnerReady(true)
      else if (message.data.type === PAGE_MESSAGES.loaded) report({ state: 'ready' })
      else report({ state: 'error', message: message.data.message })
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  useEffect(() => {
    if (runtime.isError) report({ state: 'unavailable' })
  }, [runtime.isError])

  useEffect(() => {
    if (runnerReady) return
    const timeout = window.setTimeout(() => report({ state: 'unavailable' }), RUNNER_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [runnerReady])

  useEffect(() => {
    const target = frame.current?.contentWindow
    if (!runnerReady || runtime.data === undefined || !target) return
    // '*': the runner's origin is opaque, so it cannot be named. Nothing secret is sent — the
    // page is published content and the runtime is a public file of this site.
    target.postMessage({ type: PAGE_MESSAGES.load, html, runtime: runtime.data }, '*')
    const fallback = window.setTimeout(() => report({ state: 'ready' }), READY_FALLBACK_MS)
    return () => window.clearTimeout(fallback)
  }, [runnerReady, runtime.data, html])

  /**
   * The frame loads twice: the runner, then the page it writes over itself (measured in Chromium
   * and WebKit, 2026-10-05).
   * A later load is the page taking its frame to another address — something the page check
   * forbids but cannot prove (`window['loca' + 'tion']`). The sandbox already keeps the child
   * inside Kâşif; here the frame goes away too. A browser that skips the second load only misses
   * this, it never removes a page that stayed put.
   */
  const onLoad = () => {
    loads.current += 1
    if (loads.current > 2) setLeft(true)
  }
  useEffect(() => {
    if (left) report({ state: 'blocked' })
  }, [left])

  if (left) return null
  return (
    <iframe
      ref={frame}
      src={pageRunnerUrl()}
      title={title}
      sandbox={HTML_PAGE_SANDBOX}
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      className={className}
    />
  )
}

/** FNV-1a of the page: a new page gets a fresh runner (one runner runs one page). */
function pageKey(html: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < html.length; index++) {
    hash = Math.imul(hash ^ html.charCodeAt(index), 0x01000193)
  }
  return `${html.length}:${(hash >>> 0).toString(36)}`
}

/** Runs an HTML page (AI-made or hand-written) in the page runner. */
export function HtmlPageFrame(props: HtmlPageFrameProps) {
  return <RunnerFrame key={pageKey(props.html)} {...props} />
}

/**
 * Chromium's anonymous iframe: the site gets no cookies or storage it had before and keeps none
 * afterwards (no tracking across visits). React renders it as a boolean attribute, but its types
 * do not list it yet; other browsers ignore it.
 */
const CREDENTIALLESS = { credentialless: true }

/**
 * A linked https page. Never one of this app's own origin: with `allow-same-origin` it would run
 * as the app (the Studio refuses such links too; this is the second check). No `allow` list:
 * fullscreen is Kâşif's own button around the frame, never the site's.
 */
export function UrlPageFrame({
  url,
  title,
  className,
  onLoad,
  ref,
}: {
  url: string
  title: string
  className?: string
  onLoad?: () => void
  ref?: Ref<HTMLIFrameElement>
}) {
  if (!framableOrigin(url)) return null
  return (
    <iframe
      ref={ref}
      src={url}
      title={title}
      sandbox={URL_PAGE_SANDBOX}
      {...CREDENTIALLESS}
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      className={className}
    />
  )
}
