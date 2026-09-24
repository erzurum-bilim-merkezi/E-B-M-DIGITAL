import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** `navigator.onLine`, updated on connectivity changes. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}

type Hotkey = {
  /** e.g. `mod+k`, `mod+s`, `alt+arrowup`, `shift+?`, `escape`. `mod` = Ctrl (⌘ on macOS). */
  combo: string
  handler: (event: KeyboardEvent) => void
  /** Fire even while typing in inputs (e.g. Ctrl+S). */
  allowInInputs?: boolean
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function matches(event: KeyboardEvent, combo: string) {
  const parts = combo.toLowerCase().split('+')
  const key = parts.pop() ?? ''
  const wants = new Set(parts)
  const mod = isMac() ? event.metaKey : event.ctrlKey
  if (wants.has('mod') !== mod) return false
  if (wants.has('alt') !== event.altKey) return false
  if (wants.has('shift') !== event.shiftKey && key !== '?') return false
  return event.key.toLowerCase() === key
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

export function useHotkeys(hotkeys: readonly Hotkey[], enabled = true) {
  const ref = useRef(hotkeys)
  useEffect(() => {
    ref.current = hotkeys
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      for (const hotkey of ref.current) {
        if (!matches(event, hotkey.combo)) continue
        if (isTyping(event.target) && !hotkey.allowInInputs) continue
        hotkey.handler(event)
        break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

export function modKeyLabel() {
  return isMac() ? '⌘' : 'Ctrl'
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const

/** Calls `onIdle` after `timeoutMs` without user input; restarts on every interaction. */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled = true) {
  const callback = useRef(onIdle)
  useEffect(() => {
    callback.current = onIdle
  })

  useEffect(() => {
    if (!enabled) return
    let timer = window.setTimeout(() => callback.current(), timeoutMs)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => callback.current(), timeoutMs)
    }
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, reset)
    }
  }, [enabled, timeoutMs])
}

type WakeLockSentinelLike = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
}

/** Keeps the screen on (centre tablets); re-acquired when the tab becomes visible again. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const nav: WakeLockNavigator = navigator
    if (!enabled || !nav.wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock?.request('screen')
        if (cancelled) void lock?.release()
        else sentinel = lock ?? null
      } catch {
        // Denied (battery saver, not visible) — the kiosk still works, the screen may dim.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [enabled])
}

/** Stable callback that runs `fn` once input settles for `delayMs`. */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
) {
  const fnRef = useRef(fn)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    fnRef.current = fn
  })
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const run = useCallback(
    (...args: A) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => fnRef.current(...args), delayMs)
    },
    [delayMs],
  )
  const cancel = useCallback(() => window.clearTimeout(timer.current), [])
  return { run, cancel }
}
