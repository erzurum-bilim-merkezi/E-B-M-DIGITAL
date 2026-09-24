import { useEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * After an in-app navigation, moves focus to the new page's `h1` (or to `main` while the page
 * has none) so keyboard and screen-reader users start on the new content instead of on <body>
 * or a control of the old page (WCAG 2.4.3, 4.1.3).
 *
 * Focus stays where it is on the first load (including redirects while the app starts, e.g.
 * `/` → `/hosgeldin`: the skip link comes first), on search-param-only changes (filters, tabs,
 * pagination) and when the page already moved focus into `main` itself (wizard steps, the step
 * player).
 */
export function useRouteFocus(main: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)
  const navigated = useRef(false)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (!navigated.current && navigationType === 'REPLACE') return
    navigated.current = true
    const container = main.current
    if (!container || container.contains(document.activeElement)) return
    const target = container.querySelector<HTMLElement>('h1') ?? container
    if (!target.hasAttribute('tabindex')) {
      // Focusable by script only, and only until focus moves on.
      target.setAttribute('tabindex', '-1')
      target.setAttribute('data-route-focus', '')
      target.addEventListener(
        'blur',
        () => {
          target.removeAttribute('tabindex')
          target.removeAttribute('data-route-focus')
        },
        { once: true },
      )
    }
    target.focus({ preventScroll: true })
  }, [main, navigationType, pathname])
}
