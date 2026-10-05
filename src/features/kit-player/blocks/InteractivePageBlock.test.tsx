import { http, HttpResponse } from 'msw'

import {
  BLOK_VITRINI,
  PAGE_MODULES,
  type InteractivePageStep,
  type PageSource,
} from '@/entities/kit'
import { PAGE_MESSAGES, PAGE_RUNNER_MODULES } from '@/shared/config/page-runner'
import { mockMatchMedia } from '@/test/match-media'
import { server } from '@/test/mocks/server'
import { act, fireEvent, renderWithProviders, screen } from '@/test/test-utils'

import { PlayerProvider, StepRenderer } from '../index'

const PAGE_CARD = BLOK_VITRINI.steps.find(
  (step): step is InteractivePageStep => step.type === 'interactive-page',
)

function pageCard(source?: PageSource): InteractivePageStep {
  if (!PAGE_CARD) throw new Error('Blok Vitrini has no interactive-page card')
  return source ? { ...PAGE_CARD, source } : PAGE_CARD
}

function play(step: InteractivePageStep) {
  const onComplete = vi.fn<(meta: { attempts: number }) => void>()
  const celebrate = vi.fn<(message?: string) => void>()
  const view = renderWithProviders(
    <PlayerProvider
      value={{ reducedMotion: true, motion: 'full', muted: true, celebrate, mode: 'kids' }}
    >
      <StepRenderer step={step} onComplete={onComplete} />
    </PlayerProvider>,
  )
  return { ...view, onComplete, celebrate }
}

/** A message as if the page in the runner had posted it. */
function fromPage(title: string, data: unknown) {
  const frame = screen.getByTitle(title)
  if (!(frame instanceof HTMLIFrameElement)) throw new Error('No page frame')
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow }))
  })
}

beforeEach(() => {
  mockMatchMedia()
})

describe('InteractivePageBlock', () => {
  // shared/ cannot import entities/: the runner keeps its own copy of the list pages are held to.
  it('gets from the runner exactly the modules the page check allows', () => {
    expect([...PAGE_RUNNER_MODULES]).toEqual([...PAGE_MODULES])
  })

  it('runs an HTML page in the sandboxed runner and completes with “Keşfettim”', async () => {
    const step = pageCard()
    const { user, onComplete, celebrate } = play(step)

    expect(screen.getByText(step.instructions)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sayfa hazırlanıyor…')
    expect(screen.getByTitle(step.title)).toHaveAttribute('sandbox', 'allow-scripts')
    // Nothing to complete before the page is there.
    expect(screen.queryByRole('button', { name: /Keşfettim/ })).not.toBeInTheDocument()

    fromPage(step.title, { type: PAGE_MESSAGES.loaded })
    const explored = screen.getByRole('button', { name: /Keşfettim/ })
    await user.click(explored)
    await user.click(explored)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(celebrate).toHaveBeenCalledWith(step.celebration)
    expect(explored).toHaveTextContent('Keşfettin!')
    expect(explored).toHaveAttribute('aria-disabled', 'true')
    expect(explored).toHaveFocus()
  })

  it('tells the child when the page does not fully work on this device', () => {
    const step = pageCard()
    play(step)

    fromPage(step.title, { type: PAGE_MESSAGES.error, message: 'WebGL yok' })

    expect(screen.getByText(/tam çalışmayabilir/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Keşfettim/ })).toBeInTheDocument()
  })

  it('closes a page that takes its frame elsewhere, without a way to complete it', () => {
    const step = pageCard()
    play(step)
    const frame = screen.getByTitle(step.title)

    for (let load = 0; load < 3; load++) fireEvent.load(frame)

    expect(screen.getByText('Bu sayfa kapatıldı')).toBeInTheDocument()
    expect(screen.queryByTitle(step.title)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Keşfettim/ })).not.toBeInTheDocument()
  })

  it('loads a linked page only after a tap, then moves focus into it', async () => {
    const url = 'https://phet.colorado.edu/sims/html/gravity/latest/gravity_tr.html'
    const step = pageCard({ kind: 'url', url })
    const { user } = play(step)

    expect(screen.queryByTitle(step.title)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Sayfayı aç: ${step.title}` }))

    const frame = screen.getByTitle(step.title)
    expect(frame).toHaveAttribute('src', url)
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
    expect(frame).toHaveFocus()
    expect(screen.getByRole('button', { name: /Keşfettim/ })).toBeInTheDocument()
  })

  it('offers to try again once the page could not be fetched', async () => {
    server.use(http.get('*/page-runtime/*', () => HttpResponse.error()))
    const step = pageCard()
    const { user } = play(step)

    expect(
      await screen.findByText('Bu sayfa için internet gerekli', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: /Tekrar dene/ }))

    expect(screen.getByText('Sayfa hazırlanıyor…')).toBeInTheDocument()
    expect(screen.getByTitle(step.title)).toHaveAttribute('sandbox', 'allow-scripts')
  })

  it('opens no page that fails the page check or is still empty', () => {
    const step = pageCard({
      kind: 'html',
      prompt: '',
      html: '<html><body><script>fetch("/x")</script></body></html>',
    })
    const { unmount } = play(step)
    expect(screen.getByText('Bu sayfa burada açılamıyor')).toBeInTheDocument()
    expect(screen.queryByTitle(step.title)).not.toBeInTheDocument()
    unmount()

    play(pageCard({ kind: 'html', prompt: '', html: '' }))
    expect(screen.getByText('Sayfa henüz hazır değil')).toBeInTheDocument()
  })

  it('names the other site a linked page comes from', () => {
    play(pageCard({ kind: 'url', url: 'https://phet.colorado.edu/sims/a_tr.html' }))

    expect(screen.getByText('phet.colorado.edu')).toBeInTheDocument()
  })

  it('never frames a page of this app’s own origin', () => {
    const step = pageCard({ kind: 'url', url: `${window.location.origin}/kit/blok-vitrini` })
    play(step)

    expect(screen.getByText('Bu sayfa burada açılamıyor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sayfayı aç/ })).not.toBeInTheDocument()
  })

  it('asks for the internet while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const step = pageCard()
    play(step)

    expect(screen.getByText('Bu sayfa için internet gerekli')).toBeInTheDocument()
    expect(screen.queryByTitle(step.title)).not.toBeInTheDocument()
  })
})
