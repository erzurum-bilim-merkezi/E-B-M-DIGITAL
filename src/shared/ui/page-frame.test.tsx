import { http, HttpResponse } from 'msw'

import { PAGE_MESSAGES } from '@/shared/config/page-runner'
import { PAGE_RUNTIME_SOURCE } from '@/test/mocks/handlers'
import { server } from '@/test/mocks/server'
import { act, fireEvent, renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { HtmlPageFrame, UrlPageFrame, type PageFrameStatus } from './page-frame'

const PAGE = '<!doctype html><html><head></head><body><canvas></canvas></body></html>'

function frameOf(title: string) {
  const frame = screen.getByTitle(title)
  if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
    throw new Error('The page frame has no window')
  }
  return { frame, window: frame.contentWindow }
}

/** A message as if the framed document had posted it. */
function fromFrame(source: Window | null, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source }))
  })
}

function renderPage(html = PAGE) {
  const statuses: PageFrameStatus[] = []
  const view = renderWithProviders(
    <HtmlPageFrame html={html} title="Dünya ve Ay" onStatus={(status) => statuses.push(status)} />,
  )
  return { ...view, statuses, ...frameOf('Dünya ve Ay') }
}

describe('HtmlPageFrame', () => {
  it('runs the page in the runner with scripts only — never with this app’s origin', () => {
    const { frame } = renderPage()

    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.getAttribute('src')).toMatch(/\/page-runner\.html$/)
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('hands the page and the runtime over once the runner is ready', async () => {
    const { window: runner } = renderPage()
    const post = vi.spyOn(runner, 'postMessage')

    fromFrame(runner, { type: PAGE_MESSAGES.ready })

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        { type: PAGE_MESSAGES.load, html: PAGE, runtime: PAGE_RUNTIME_SOURCE },
        '*',
      ),
    )
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('ignores messages of other windows and unknown shapes', async () => {
    const { window: runner, statuses } = renderPage()
    const post = vi.spyOn(runner, 'postMessage')

    fromFrame(window, { type: PAGE_MESSAGES.ready })
    fromFrame(runner, { type: 'kasif:page-runner:hazir' })
    fromFrame(runner, 'ready')
    fromFrame(window, { type: PAGE_MESSAGES.loaded })

    // Give the runtime query time to settle: still nothing may be sent.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(post).not.toHaveBeenCalled()
    expect(statuses).toEqual([{ state: 'loading' }])
  })

  it('reports loading, then ready when the page has loaded', () => {
    const { window: runner, statuses } = renderPage()

    fromFrame(runner, { type: PAGE_MESSAGES.loaded })
    fromFrame(runner, { type: PAGE_MESSAGES.loaded })

    expect(statuses).toEqual([{ state: 'loading' }, { state: 'ready' }])
  })

  it('passes on what went wrong inside the page', () => {
    const { window: runner, statuses } = renderPage()

    fromFrame(runner, { type: PAGE_MESSAGES.error, message: 'WebGL yok' })
    fromFrame(runner, { type: PAGE_MESSAGES.error, message: 42 })

    expect(statuses.slice(1)).toEqual([
      { state: 'error', message: 'WebGL yok' },
      { state: 'error', message: '' },
    ])
  })

  it('says the page is unavailable when the runtime cannot be fetched', async () => {
    server.use(http.get('*/page-runtime/*', () => HttpResponse.error()))
    const { statuses } = renderPage()

    await waitFor(() => expect(statuses).toContainEqual({ state: 'unavailable' }), {
      timeout: 4000,
    })
  })

  it('keeps an error the page threw before it finished loading', () => {
    const { window: runner, statuses } = renderPage()

    fromFrame(runner, { type: PAGE_MESSAGES.error, message: 'THREE is not defined' })
    fromFrame(runner, { type: PAGE_MESSAGES.loaded })

    expect(statuses.at(-1)).toEqual({ state: 'error', message: 'THREE is not defined' })
  })

  it('gives up on a runner that never says it is ready', () => {
    vi.useFakeTimers()
    try {
      const { statuses, window: runner } = renderPage()
      act(() => vi.advanceTimersByTime(19_000))
      expect(statuses.at(-1)).toEqual({ state: 'loading' })

      act(() => vi.advanceTimersByTime(1_000))
      expect(statuses.at(-1)).toEqual({ state: 'unavailable' })
      // A late page does not pretend everything is fine.
      fromFrame(runner, { type: PAGE_MESSAGES.loaded })
      expect(statuses.at(-1)).toEqual({ state: 'unavailable' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('removes the frame when the page takes it to another address', () => {
    const { frame, statuses } = renderPage()

    // The runner, then the page it wrote over itself: both expected.
    fireEvent.load(frame)
    fireEvent.load(frame)
    expect(screen.getByTitle('Dünya ve Ay')).toBe(frame)

    fireEvent.load(frame)

    expect(screen.queryByTitle('Dünya ve Ay')).not.toBeInTheDocument()
    expect(statuses.at(-1)).toEqual({ state: 'blocked' })
  })

  it('starts a fresh runner for a new page', () => {
    const { frame, rerender } = renderPage()

    rerender(<HtmlPageFrame html={`${PAGE}\n`} title="Dünya ve Ay" />)

    expect(screen.getByTitle('Dünya ve Ay')).not.toBe(frame)
  })
})

describe('UrlPageFrame', () => {
  it('frames another site’s https page without popups or top navigation', () => {
    renderWithProviders(
      <UrlPageFrame url="https://phet.colorado.edu/sims/a_tr.html" title="Simülasyon" />,
    )
    const frame = screen.getByTitle('Simülasyon')

    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
    expect(frame.getAttribute('sandbox')).not.toMatch(/popups|top-navigation|forms|modals/)
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer')
    // No cookies or storage of its own (Chromium), and no fullscreen of its own.
    expect(frame).toHaveAttribute('credentialless')
    expect(frame).not.toHaveAttribute('allow')
  })

  it.each([
    ['http', 'http://phet.colorado.edu/a.html'],
    ['a broken address', 'ornek'],
    ['this app’s own origin', `${window.location.origin}/kit/blok-vitrini`],
  ])('frames nothing for %s', (_, url) => {
    renderWithProviders(<UrlPageFrame url={url} title="Sayfa" />)

    expect(screen.queryByTitle('Sayfa')).not.toBeInTheDocument()
  })
})
