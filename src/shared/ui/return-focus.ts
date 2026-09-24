import { useState, type RefObject } from 'react'

// Focus return for overlays (dialogs, sheets, the command palette) — WCAG 2.4.3.

export type ReturnFocusProps = {
  /**
   * Element to focus when the overlay closes. Defaults to whatever had focus when it opened —
   * for a menu item, the menu's trigger (the item disappears with the menu).
   */
  returnFocusTo?: RefObject<HTMLElement | null>
}

const OVERLAY = '[role="dialog"], [role="alertdialog"]'

/** Where each open overlay returns focus, so an overlay opened from inside it can fall back. */
const openersByOverlay = new WeakMap<Element, readonly HTMLElement[]>()
/** Return targets handed over by an overlay that closed while this one replaced it. */
const inheritedByOverlay = new WeakMap<Element, readonly HTMLElement[]>()

/** What had focus as an overlay opened, followed by the openers of the overlay it sits in. */
function captureOpeners(): readonly HTMLElement[] {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return []
  // Radix labels a menu by its trigger: return there, not to the item that is about to vanish.
  const menu = active.closest('[role="menu"]')
  const triggerId = menu?.getAttribute('aria-labelledby')
  const trigger = triggerId ? document.getElementById(triggerId) : null
  const opener = menu ? trigger : active
  const host = (opener ?? active).closest(OVERLAY)
  const inherited = (host && openersByOverlay.get(host)) || []
  return opener ? [opener, ...inherited] : inherited
}

/**
 * Hands focus back to the opener when an overlay closes. Radix only restores focus to its own
 * `*Trigger`; ours are mostly opened from click handlers, hotkeys or menu items, where focus
 * would otherwise fall to <body>. Call it in a component that mounts with the overlay content —
 * the opener is recorded while that component first renders — and spread the result onto the
 * Radix `Content`.
 */
export function useReturnFocus(returnFocusTo?: RefObject<HTMLElement | null>) {
  const [openers] = useState(captureOpeners)
  const own = () => {
    const preferred = returnFocusTo?.current
    return preferred ? [preferred, ...openers] : openers
  }
  return {
    onOpenAutoFocus: (event: Event) => {
      if (event.currentTarget instanceof Element) openersByOverlay.set(event.currentTarget, own())
    },
    onCloseAutoFocus: (event: Event) => {
      const container = event.currentTarget instanceof Element ? event.currentTarget : null
      const candidates = [...own(), ...((container && inheritedByOverlay.get(container)) || [])]
      const active = document.activeElement
      if (active && active !== document.body) {
        // Focus was already placed on purpose: a route change focused the new page heading, or
        // an overlay that replaced this one took it — that one returns to this one's opener.
        event.preventDefault()
        const next = active.closest(OVERLAY)
        if (next)
          inheritedByOverlay.set(next, [...(inheritedByOverlay.get(next) ?? []), ...candidates])
        return
      }
      const target = candidates.find((element) => element.isConnected)
      if (!target) return // Radix default: its Trigger, if there is one
      event.preventDefault()
      target.focus()
    },
  }
}

type AutoFocusHandlers = {
  onOpenAutoFocus?: ((event: Event) => void) | undefined
  onCloseAutoFocus?: ((event: Event) => void) | undefined
}

/**
 * `useReturnFocus` for the shared overlay primitives: the caller's own autofocus handlers run
 * first, and a caller that prevents the default opts out of the focus return.
 */
export function useOverlayAutoFocus(
  returnFocusTo: RefObject<HTMLElement | null> | undefined,
  { onOpenAutoFocus, onCloseAutoFocus }: AutoFocusHandlers,
) {
  const focusReturn = useReturnFocus(returnFocusTo)
  return {
    onOpenAutoFocus: (event: Event) => {
      onOpenAutoFocus?.(event)
      focusReturn.onOpenAutoFocus(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (!event.defaultPrevented) focusReturn.onCloseAutoFocus(event)
    },
  }
}
