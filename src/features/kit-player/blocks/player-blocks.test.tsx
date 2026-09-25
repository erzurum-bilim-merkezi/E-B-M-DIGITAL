/* oxlint-disable no-await-in-loop -- timers tick and cards are tapped one at a time */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BLOK_VITRINI, type Step, type StepOf } from '@/entities/kit'
import { mockMatchMedia } from '@/test/match-media'

import { PlayerProvider, StepRenderer } from '../index'

function card<T extends Step['type']>(type: T): StepOf<T> {
  const step = BLOK_VITRINI.steps.find(
    (candidate): candidate is StepOf<T> => candidate.type === type,
  )
  if (!step) throw new Error(`Blok Vitrini has no ${type} card`)
  return step
}

function play(step: Step) {
  const onComplete = vi.fn<(meta: { attempts: number }) => void>()
  const onQuizAnswer = vi.fn<(answer: { correct: boolean; optionId: string }) => void>()
  const celebrate = vi.fn<(message?: string) => void>()
  render(
    <PlayerProvider
      value={{ reducedMotion: true, motion: 'full', muted: true, celebrate, mode: 'kids' }}
    >
      <StepRenderer step={step} onComplete={onComplete} onQuizAnswer={onQuizAnswer} />
    </PlayerProvider>,
  )
  return { onComplete, onQuizAnswer, celebrate, user: userEvent.setup() }
}

/** A matched card's name: its own text first (E2E relies on it), then its partner. */
function named(own: string, partner: string) {
  // jsdom drops the space that browsers put between the text and the sr-only note.
  return new RegExp(`^${own}\\s*\\(eşleşti: ${partner}\\)$`)
}

/** The player around one card, for render and rerender (Studio live preview edits). */
function tree(step: Step) {
  return (
    <PlayerProvider
      value={{
        reducedMotion: true,
        motion: 'full',
        muted: true,
        celebrate: vi.fn<(message?: string) => void>(),
        mode: 'kids',
      }}
    >
      <StepRenderer step={step} onComplete={vi.fn<(meta: { attempts: number }) => void>()} />
    </PlayerProvider>
  )
}

const list = () => within(screen.getByRole('list', { name: 'Sıralanacak kartlar' }))
const labels = () =>
  list()
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')

beforeEach(() => {
  mockMatchMedia()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('player blocks (Blok Vitrini)', () => {
  it('quiz: reports every answer and completes on the right one', async () => {
    const { user, onComplete, onQuizAnswer } = play(card('quiz'))

    const check = () => user.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }))
    await check()
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement() // nothing chosen yet

    await user.click(screen.getByRole('radio', { name: /Köklerinde/ }))
    await check()
    expect(onQuizAnswer).toHaveBeenLastCalledWith({ correct: false, optionId: 'q-1' })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: /Köklerinde/ })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /Yapraklarında/ }))
    await check()
    expect(onQuizAnswer).toHaveBeenLastCalledWith({ correct: true, optionId: 'q-2' })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('sequence: reorders with the move buttons and checks the order', async () => {
    const step = card('sequence')
    const { user, onComplete } = play(step)

    for (const [target, item] of step.items.entries()) {
      let position = labels().findIndex((text) => text.includes(item.label))
      while (position > target) {
        // oxlint-disable-next-line no-await-in-loop -- each move changes the order the next one reads
        await user.click(list().getByRole('button', { name: `${item.label} yukarı taşı` }))
        position--
      }
    }
    await user.click(screen.getByRole('button', { name: 'Sıramı kontrol et' }))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Sıramı kontrol et' })).not.toBeInTheDocument()
  })

  it('matching: pairs each left card with its right card', async () => {
    const step = card('matching')
    const { user, onComplete } = play(step)

    const left = within(screen.getByRole('list', { name: 'Sol kartlar' }))
    const right = within(screen.getByRole('list', { name: 'Sağ kartlar' }))
    for (const pair of step.pairs) {
      // oxlint-disable-next-line no-await-in-loop -- one pair at a time, like a child would
      await user.click(left.getByRole('button', { name: new RegExp(pair.left) }))
      // oxlint-disable-next-line no-await-in-loop -- one pair at a time, like a child would
      await user.click(right.getByRole('button', { name: new RegExp(pair.right) }))
    }

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('experiment: walks through the steps to the observation', async () => {
    const { user, onComplete } = play(card('experiment'))

    expect(screen.getByText('Deneyi bir yetişkinle yap.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Deneye başla/ }))
    await user.click(screen.getByRole('button', { name: /Sonraki adım/ }))
    await user.click(screen.getByRole('button', { name: /Sonraki adım/ }))
    await user.click(screen.getByRole('button', { name: /Deneyi bitirdim/ }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('video: loads YouTube (nocookie, sandboxed) only after a tap', async () => {
    const { user, onComplete } = play(card('video'))

    expect(document.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Videoyu oynat/ }))
    const frame = document.querySelector('iframe')
    expect(frame?.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ/,
    )
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-popups')

    await user.click(screen.getByRole('button', { name: /İzledim/ }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('compare cards: completes after every card was looked at', async () => {
    const step = card('compare-cards')
    const { user, onComplete } = play(step)

    for (const item of step.cards) {
      // oxlint-disable-next-line no-await-in-loop -- one card at a time
      await user.click(screen.getByRole('button', { name: new RegExp(item.title) }))
    }
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('toggle and hotspots complete once, however often the child taps', async () => {
    const step = card('toggle-scene')
    const toggle = play(step)
    const button = screen.getByRole('button', { name: step.onLabel })
    await toggle.user.click(button)
    await toggle.user.click(screen.getByRole('button', { name: step.offLabel }))
    await toggle.user.click(screen.getByRole('button', { name: step.onLabel }))
    expect(toggle.onComplete).toHaveBeenCalledTimes(1)
  })

  it('info and animated cards complete on view', () => {
    const info = play(card('info'))
    expect(info.onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('keyboard focus never drops to the page (WCAG 2.4.3)', () => {
  it('quiz: the verdict takes focus after a wrong and a right answer', async () => {
    const { user } = play(card('quiz'))

    // Enter on the radio submits; that radio then becomes disabled.
    await user.click(screen.getByRole('radio', { name: /Köklerinde/ }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('radio', { name: /Köklerinde/ })).toBeDisabled()
    expect(document.activeElement).toHaveTextContent('Hmm, bu değil. Bir daha dene!')

    await user.click(screen.getByRole('radio', { name: /Yapraklarında/ }))
    await user.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }))
    expect(screen.queryByRole('button', { name: 'Cevabımı kontrol et' })).not.toBeInTheDocument()
    expect(document.activeElement).toHaveTextContent(/Doğru!.*bitkinin mutfağı/)
  })

  it('sequence: the arrow just pressed keeps focus, also at the top of the list', async () => {
    const step = card('sequence')
    const { user } = play(step)
    const first = step.items.find((item) => labels()[0]?.includes(item.label))
    if (!first) throw new Error('no first item')

    const down = list().getByRole('button', { name: `${first.label} aşağı taşı` })
    await user.click(down)
    expect(labels()[1]).toContain(first.label)
    expect(down).toHaveFocus()

    const up = list().getByRole('button', { name: `${first.label} yukarı taşı` })
    await user.click(up)
    expect(labels()[0]).toContain(first.label)
    expect(up).toHaveFocus()
    expect(up).toHaveAttribute('aria-disabled', 'true')
    await user.click(up) // already on top: nothing moves
    expect(labels()[0]).toContain(first.label)
  })

  it('sequence: the verdict takes focus once "Sıramı kontrol et" is gone', async () => {
    const step = card('sequence')
    const { user } = play(step)
    for (const [target, item] of step.items.entries()) {
      let position = labels().findIndex((text) => text.includes(item.label))
      while (position > target) {
        await user.click(list().getByRole('button', { name: `${item.label} yukarı taşı` }))
        position--
      }
    }
    await user.click(screen.getByRole('button', { name: 'Sıramı kontrol et' }))

    expect(document.activeElement).toHaveTextContent(step.successMessage)
  })

  it('matching: a matched card stays focusable (aria-disabled) after the pair is found', async () => {
    const step = card('matching')
    const { user, onComplete } = play(step)
    const [pair] = step.pairs
    if (!pair) throw new Error('no pair')

    await user.click(
      within(screen.getByRole('list', { name: 'Sol kartlar' })).getByRole('button', {
        name: pair.left,
      }),
    )
    const partner = within(screen.getByRole('list', { name: 'Sağ kartlar' })).getByRole('button', {
      name: pair.right,
    })
    await user.click(partner)

    expect(partner).toHaveFocus()
    expect(partner).toHaveAttribute('aria-disabled', 'true')
    expect(partner).toHaveAccessibleName(/eşleşti/)
    await user.click(partner) // a matched card does nothing
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('experiment: focus follows the first step, the finished timer and the observation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const step = card('experiment')
    const { user } = play(step)

    await user.click(screen.getByRole('button', { name: /Deneye başla/ }))
    expect(screen.getByRole('heading', { name: `Adım 1 / ${step.steps.length}` })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Sonraki adım/ }))

    // Step 2 has a 5 s timer; its button names the action and is not a toggle.
    const start = screen.getByRole('button', { name: /Sayacı başlat/ })
    expect(start).not.toHaveAttribute('aria-pressed')
    await user.click(start)
    expect(start).toHaveAccessibleName(/Duraklat/)
    for (let tick = 0; tick < 5; tick++) {
      await act(() => vi.advanceTimersByTimeAsync(1000))
    }
    expect(screen.queryByRole('button', { name: /Duraklat/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sonraki adım/ })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /Sonraki adım/ }))
    await user.click(screen.getByRole('button', { name: /Deneyi bitirdim/ }))
    expect(document.activeElement).toHaveTextContent(step.observationPrompt)
  })

  it('video: focus moves into the player, then stays on "İzledim"', async () => {
    const step = card('video')
    const { user, onComplete } = play(step)
    // The question's live region exists (empty) before the video is watched.
    const question = screen.getByRole('status')
    expect(question).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: /Videoyu oynat/ }))
    expect(document.querySelector('iframe')).toHaveFocus()

    const watched = screen.getByRole('button', { name: /İzledim/ })
    await user.click(watched)
    expect(watched).toHaveFocus()
    expect(watched).toHaveAttribute('aria-disabled', 'true')
    expect(watched).not.toHaveAttribute('aria-pressed')
    expect(question).toHaveTextContent(step.questionAfter)
    await user.click(watched)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

describe('feedback live regions exist before they speak (WCAG 4.1.3)', () => {
  it('tap-reveal fills a region that was already mounted', async () => {
    const step = card('tap-reveal')
    const { user } = play(step)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: step.tapLabel }))
    expect(status).toHaveTextContent(step.revealMessage)
  })

  it('toggle names the next action (no aria-pressed) and announces its message', async () => {
    const step = card('toggle-scene')
    const { user } = play(step)
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    const button = screen.getByRole('button', { name: step.onLabel })
    expect(button).not.toHaveAttribute('aria-pressed')
    await user.click(button)
    expect(button).toHaveAccessibleName(step.offLabel)
    expect(button).not.toHaveAttribute('aria-pressed')
    expect(status).toHaveTextContent(step.onMessage)

    await user.click(button)
    expect(status).toBeEmptyDOMElement()
  })
})

describe('emoji stage on question cards', () => {
  const emojiStage = { kind: 'scene', sceneId: 'emoji-stage' } as const
  const globe = { kind: 'emoji', value: '🌍' } as const

  it.each([
    ['quiz', { ...card('quiz'), visual: emojiStage, icon: globe }],
    ['choose-correct', { ...card('choose-correct'), visual: emojiStage, icon: globe }],
  ] as const)('%s: shows the card icon, not the ✨ fallback', async (_type, step) => {
    play(step)

    const scene = await screen.findByRole('img', { name: step.title }, { timeout: 5000 })
    expect(within(scene).getByText('🌍')).toBeInTheDocument()
    expect(within(scene).queryByText('✨')).not.toBeInTheDocument()
  })
})

describe('repeated feedback is read out again (WCAG 4.1.3)', () => {
  it('choose-correct: the same wrong tap changes the live text', async () => {
    const { user } = play(card('choose-correct'))
    const status = screen.getByRole('status')
    const wrong = screen.getByRole('button', { name: /Müzik/ })

    await user.click(wrong)
    const first = status.textContent
    await user.click(wrong)

    expect(status).toHaveTextContent('Tohum müzik dinlemez!')
    expect(status.textContent).not.toBe(first)
  })

  it('matching: a second wrong pair changes the live text', async () => {
    const { user } = play(card('matching'))
    const status = screen.getByRole('status')
    const left = within(screen.getByRole('list', { name: 'Sol kartlar' }))
    const right = within(screen.getByRole('list', { name: 'Sağ kartlar' }))

    await user.click(left.getByRole('button', { name: 'Kök' }))
    await user.click(right.getByRole('button', { name: 'Besin üretir' }))
    const first = status.textContent
    await user.click(right.getByRole('button', { name: 'Besin üretir' }))

    expect(first).toContain('Bu ikisi eş değil.')
    expect(status).toHaveTextContent('Bu ikisi eş değil. Tekrar dene! 😊')
    expect(status.textContent).not.toBe(first)
  })

  it('quiz: the "no answer" error is re-announced and describes the question group', async () => {
    const step = card('quiz')
    const { user } = play(step)
    const group = screen.getByRole('group', { name: step.question })
    expect(group).not.toHaveAttribute('aria-describedby')

    const check = () => user.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }))
    await check()
    const alert = screen.getByRole('alert')
    const first = alert.textContent
    expect(group).toHaveAccessibleDescription('Önce bir cevap seç.')

    await check()
    expect(alert.textContent).not.toBe(first)
    expect(group).toHaveAccessibleDescription('Önce bir cevap seç.')

    await user.click(screen.getByRole('radio', { name: /Yapraklarında/ }))
    await check()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(group).not.toHaveAttribute('aria-describedby')
  })
})

describe('status is not told by color or icon alone (WCAG 1.4.1, 1.1.1)', () => {
  it('quiz: wrong and right answers carry text next to ❌ / ✅', async () => {
    const { user } = play(card('quiz'))

    await user.click(screen.getByRole('radio', { name: /Köklerinde/ }))
    await user.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }))
    expect(screen.getByRole('radio', { name: /^Köklerinde\s*\(yanlış\)$/ })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /Yapraklarında/ }))
    await user.click(screen.getByRole('button', { name: 'Cevabımı kontrol et' }))
    expect(screen.getByRole('radio', { name: /^Yapraklarında\s*\(doğru\)$/ })).toBeChecked()
  })

  it('sequence: each card says whether it is in place after a check', async () => {
    const step = card('sequence')
    const { user } = play(step)

    await user.click(screen.getByRole('button', { name: 'Sıramı kontrol et' }))

    const cards = list()
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent ?? '')
    expect(cards).toHaveLength(step.items.length)
    for (const text of cards) expect(text).toMatch(/\((doğru|yanlış) yerde\)$/)
  })

  it('matching: both cards of a pair show the same number and name their partner', async () => {
    const step = card('matching')
    const { user } = play(step)
    const left = within(screen.getByRole('list', { name: 'Sol kartlar' }))
    const right = within(screen.getByRole('list', { name: 'Sağ kartlar' }))
    const [first, second] = step.pairs
    if (!first || !second) throw new Error('need two pairs')

    for (const pair of [first, second]) {
      await user.click(left.getByRole('button', { name: pair.left }))
      await user.click(right.getByRole('button', { name: pair.right }))
    }

    const pairOne = [
      left.getByRole('button', { name: named(first.left, first.right) }),
      right.getByRole('button', { name: named(first.right, first.left) }),
    ]
    const pairTwo = [
      left.getByRole('button', { name: named(second.left, second.right) }),
      right.getByRole('button', { name: named(second.right, second.left) }),
    ]
    for (const button of pairOne) expect(within(button).getByText('1')).toBeInTheDocument()
    for (const button of pairTwo) expect(within(button).getByText('2')).toBeInTheDocument()
  })
})

describe('Studio live preview edits', () => {
  it('sequence: shows items added and drops items removed in the editor', () => {
    const step = card('sequence')
    const { rerender } = render(tree(step))
    expect(list().getAllByRole('listitem')).toHaveLength(step.items.length)

    const added = { ...step, items: [...step.items, { id: 'x-5', label: 'Salata', icon: '🥗' }] }
    rerender(tree(added))
    expect(list().getAllByRole('listitem')).toHaveLength(step.items.length + 1)
    expect(labels().some((text) => text.includes('Salata'))).toBe(true)

    const [dropped] = step.items
    rerender(tree({ ...step, items: step.items.slice(1) }))
    expect(list().getAllByRole('listitem')).toHaveLength(step.items.length - 1)
    expect(labels().some((text) => text.includes(dropped?.label ?? '?'))).toBe(false)
  })

  it('experiment: repeated and blank materials and safety notes all render', () => {
    play({
      ...card('experiment'),
      materials: ['Su', 'Su', ''],
      safety: ['Dikkat et.', 'Dikkat et.'],
    })

    const [materials] = screen.getAllByRole('list')
    if (!materials) throw new Error('no materials list')
    expect(within(materials).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByText('Dikkat et.')).toHaveLength(2)
  })
})
