import type { KeyboardEvent } from 'react'

/**
 * Arrow-key navigation for composite widgets built from buttons (WAI-ARIA APG): custom card
 * radio groups (`role="radio"`) and option grids (`role="option"`). Attach to the container's
 * `onKeyDown`; give the items a roving `tabIndex` (0 on the current item, -1 elsewhere).
 *
 * - ←/→ move by one, ↑/↓ by one row (columns are measured from the layout), Home/End jump.
 * - `activate: true` (radio groups) also selects the item focus moves to, like native radios.
 */
export function handleRovingKeys(
  event: KeyboardEvent<HTMLElement>,
  { selector, activate = false }: { selector: string; activate?: boolean },
) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(selector)].filter(
    (item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true',
  )
  const current = items.findIndex((item) => item === document.activeElement)
  if (current < 0 || items.length === 0) return

  const firstTop = items[0]?.offsetTop ?? 0
  const columns = Math.max(1, items.filter((item) => item.offsetTop === firstTop).length)
  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'

  let next = current
  switch (event.key) {
    case 'ArrowRight':
      next = current + (rtl ? -1 : 1)
      break
    case 'ArrowLeft':
      next = current + (rtl ? 1 : -1)
      break
    case 'ArrowDown':
      next = current + columns
      break
    case 'ArrowUp':
      next = current - columns
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = items.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  // Radios wrap around like native ones; grids stop at the edges.
  const target = activate
    ? items.at(((next % items.length) + items.length) % items.length)
    : items[Math.min(items.length - 1, Math.max(0, next))]
  if (!target || target === items[current]) return
  target.focus()
  if (activate) target.click()
}

/** Roving tab stop: the selected item, or the first one when nothing is selected. */
export function rovingTabIndex(index: number, selectedIndex: number) {
  return index === (selectedIndex >= 0 ? selectedIndex : 0) ? 0 : -1
}
