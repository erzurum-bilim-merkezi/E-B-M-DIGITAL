import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type FocusTarget = RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined)

function resolve(target: FocusTarget) {
  return typeof target === 'function' ? target() : target.current
}

/**
 * Moves keyboard focus once React has committed the update that renders the target (WCAG 2.4.3).
 * Use it where a tap removes or disables the focused control: call `focusAfterUpdate(target)` in
 * the same handler as the state change, and the result (feedback, next step heading, the trigger
 * of a closed confirm…) gets focus instead of `<body>`.
 */
export function useFocusAfterUpdate() {
  const pending = useRef<FocusTarget | null>(null)
  // A request always re-renders, so it is served even when the other state did not change.
  const [request, setRequest] = useState(0)

  useEffect(() => {
    const target = pending.current
    pending.current = null
    if (request === 0 || !target) return
    resolve(target)?.focus()
  }, [request])

  return useCallback((target: FocusTarget) => {
    pending.current = target
    setRequest((count) => count + 1)
  }, [])
}

const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function tabbables(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) => element.tabIndex >= 0,
  )
}

/**
 * Keeps keyboard focus inside a modal overlay (`aria-modal="true"`) while `active`: Tab and
 * Shift+Tab wrap around its controls, and focus that lands outside (a tap on the backdrop, the
 * skip link) is pulled back to its first control.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const root = container.current
      if (event.key !== 'Tab' || !root) return
      const items = tabbables(root)
      const first = items[0]
      const last = items.at(-1)
      const current = document.activeElement
      if (!first || !last) {
        event.preventDefault()
        return
      }
      if (!root.contains(current)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && current === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      const root = container.current
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        tabbables(root)[0]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [active, container])
}
