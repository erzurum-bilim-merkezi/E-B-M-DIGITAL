import { useEffect, useState, type RefObject } from 'react'

/**
 * Whether an element currently overflows its box. A scroll container must be keyboard-reachable
 * (axe `scrollable-region-focusable`), so callers make it focusable only while it really scrolls.
 */
export function useIsScrollable(ref: RefObject<HTMLElement | null>) {
  const [scrollable, setScrollable] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () =>
      setScrollable(
        element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      )
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    return () => observer.disconnect()
  }, [ref])

  return scrollable
}
