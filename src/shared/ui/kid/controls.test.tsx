import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { stopSpeech } from '@/shared/hooks/useSpeech'

import { MotionToggle, SpeechBubble } from './controls'
import { SpeakButton } from './SpeakButton'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  voice: unknown = null
  constructor(text: string) {
    this.text = text
  }
  addEventListener() {}
}

function MotionHarness() {
  const [paused, setPaused] = useState(false)
  return <MotionToggle paused={paused} onToggle={() => setPaused(!paused)} />
}

afterEach(() => {
  stopSpeech()
})

describe('SpeechBubble live (WCAG 4.1.3)', () => {
  it('stays mounted as an empty status region and only swaps its text', () => {
    const { rerender } = render(<SpeechBubble live>{null}</SpeechBubble>)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()

    rerender(<SpeechBubble live>Filiz çıktı!</SpeechBubble>)
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Filiz çıktı!')

    rerender(<SpeechBubble live>{''}</SpeechBubble>)
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toBeEmptyDOMElement()
  })
})

describe('toggles name the action instead of claiming a pressed state (WCAG 4.1.2)', () => {
  it('MotionToggle: "Durdur" ↔ "Oynat" without aria-pressed', async () => {
    render(<MotionHarness />)
    const user = userEvent.setup()

    const button = screen.getByRole('button', { name: 'Durdur' })
    expect(button).not.toHaveAttribute('aria-pressed')
    await user.click(button)
    expect(button).toHaveAccessibleName('Oynat')
    expect(button).not.toHaveAttribute('aria-pressed')
  })

  it('SpeakButton: "Dinle" ↔ "Dur" without aria-pressed', async () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn<(utterance: unknown) => void>(),
      cancel: vi.fn<() => void>(),
      getVoices: () => [],
    })
    render(<SpeakButton text="Tohum nedir?" />)
    const user = userEvent.setup()

    const button = screen.getByRole('button', { name: 'Dinle' })
    expect(button).not.toHaveAttribute('aria-pressed')
    await user.click(button)
    expect(button).toHaveAccessibleName('Dur')
    expect(button).not.toHaveAttribute('aria-pressed')
  })
})
