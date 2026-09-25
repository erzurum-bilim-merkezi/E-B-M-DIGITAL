import { useState } from 'react'

import {
  BLOCK_CATALOG,
  BLOK_VITRINI,
  type AiField,
  type BlockType,
  type KitIcon,
  type KitIssue,
  type MediaRef,
  type Step,
  type StepOf,
} from '@/entities/kit'
import { act, renderWithProviders, screen, within } from '@/test/test-utils'

import { EditorServicesProvider, type AiCardText, type EditorServices } from '../../index'
import { StepEditor } from './StepEditor'

const AUDIO: MediaRef = { assetId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' }

const AI_TEXT: AiCardText = {
  title: 'Bitki nerede beslenir?',
  answer: 'Yapraklarında.',
  narration: 'Bitkiler yapraklarında beslenir.',
  hint: 'Yaprağa bak',
  celebration: 'Süper!',
  options: ['Yaprak', 'Kök'],
  correctCount: 1,
}

function sample<T extends BlockType>(type: T): StepOf<T> {
  const step = BLOK_VITRINI.steps.find(
    (candidate): candidate is StepOf<T> => candidate.type === type,
  )
  if (!step) throw new Error(`BLOK_VITRINI has no ${type} card`)
  return step
}

function IconInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: KitIcon
  onChange: (icon: KitIcon) => void
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value.kind === 'emoji' ? value.value : ''}
        onChange={(event) => onChange({ kind: 'emoji', value: event.target.value })}
      />
    </>
  )
}

function PickableMedia({
  label,
  value,
  onChange,
}: {
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}) {
  return value ? (
    <button type="button" onClick={() => onChange(undefined)}>{`${label}: kaldır`}</button>
  ) : (
    <button type="button" onClick={() => onChange(AUDIO)}>{`${label}: seç`}</button>
  )
}

function AiTextButton({
  onApply,
}: {
  step: Step
  onApply: (draft: AiCardText, fields: AiField[]) => void
}) {
  return (
    <button type="button" onClick={() => onApply(AI_TEXT, ['title'])}>
      Yapay zekâyla yaz
    </button>
  )
}

const SERVICES: EditorServices = {
  IconField: IconInput,
  ImageField: PickableMedia,
  AudioField: PickableMedia,
  CaptionsField: PickableMedia,
  AiTextButton,
  assets: new Map(),
  Preview: () => null,
  SceneThumb: () => null,
}

function Harness({
  initial,
  issues,
  slugLocked,
  onStep,
}: {
  initial: Step
  issues: KitIssue[]
  slugLocked: boolean
  onStep: (step: Step) => void
}) {
  const [step, setStep] = useState(initial)
  return (
    <StepEditor
      kit={BLOK_VITRINI}
      step={step}
      issues={issues}
      slugLocked={slugLocked}
      onChange={(next) => {
        onStep(next)
        setStep(next)
      }}
    />
  )
}

function renderStepEditor(
  initial: Step,
  {
    issues = [],
    slugLocked = false,
    services = SERVICES,
  }: { issues?: KitIssue[]; slugLocked?: boolean; services?: EditorServices } = {},
) {
  const steps: Step[] = []
  const view = renderWithProviders(
    <EditorServicesProvider value={services}>
      <Harness
        initial={initial}
        issues={issues}
        slugLocked={slugLocked}
        onStep={(step) => steps.push(step)}
      />
    </EditorServicesProvider>,
  )
  return { ...view, current: () => steps.at(-1) ?? initial }
}

describe('StepEditor', () => {
  it('shows the block type, QR code and what the block does', () => {
    const step = sample('tap-reveal')
    renderStepEditor(step)

    const meta = BLOCK_CATALOG['tap-reveal']
    expect(screen.getByText(meta.label)).toBeInTheDocument()
    expect(screen.getByText(`QR ${step.qrCode}`)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(meta.description)
    expect(screen.getByRole('textbox', { name: 'Soru / kart başlığı' })).toHaveValue(step.title)
  })

  it('keeps the card address in step with the title before the first publish', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))
    const title = screen.getByRole('textbox', { name: 'Soru / kart başlığı' })

    await user.clear(title)
    await user.type(title, 'Quiz')

    // "quiz" belongs to another card of the kit.
    expect(current()).toMatchObject({ title: 'Quiz', slug: 'quiz-2' })
  })

  it('keeps the card address once the kit was published', async () => {
    const step = sample('tap-reveal')
    const { user, current } = renderStepEditor(step, { slugLocked: true })

    await user.type(screen.getByRole('textbox', { name: 'Soru / kart başlığı' }), '!')

    expect(current()).toMatchObject({ title: `${step.title}!`, slug: step.slug })
  })

  it('edits the answer, hint, celebration and whether the card is required', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))

    await user.clear(screen.getByRole('textbox', { name: /^Cevap/ }))
    await user.click(screen.getByRole('textbox', { name: /^Cevap/ }))
    await user.paste('Filiz çıkar.')
    await user.clear(screen.getByRole('textbox', { name: 'İpucu' }))
    await user.click(screen.getByRole('textbox', { name: 'İpucu' }))
    await user.paste('Dokun!')
    await user.clear(screen.getByRole('textbox', { name: 'Kutlama mesajı' }))
    await user.click(screen.getByRole('textbox', { name: 'Kutlama mesajı' }))
    await user.paste('Yaşasın!')
    await user.click(screen.getByRole('switch', { name: 'Zorunlu kart' }))

    expect(current()).toMatchObject({
      answer: 'Filiz çıkar.',
      hint: 'Dokun!',
      celebration: 'Yaşasın!',
      required: false,
    })
  })

  it('edits the narration', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))
    const narration = screen.getByRole('textbox', { name: 'Anlatım (Dinle)' })

    await user.clear(narration)
    await user.click(narration)
    await user.paste('Tohuma dokun.')

    expect(current().narration).toBe('Tohuma dokun.')
  })

  it('sets the card color and icon', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))

    await user.click(
      within(screen.getByRole('group', { name: 'Kart rengi' })).getByRole('radio', {
        name: 'Mor',
      }),
    )
    await user.clear(screen.getByRole('textbox', { name: 'Kart ikonu' }))
    await user.type(screen.getByRole('textbox', { name: 'Kart ikonu' }), '🌵')

    expect(current()).toMatchObject({ cardColor: 'purple', icon: { kind: 'emoji', value: '🌵' } })
  })

  it('attaches and removes a recorded narration', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))

    await user.click(screen.getByRole('button', { name: 'Hazır ses kaydı (isteğe bağlı): seç' }))
    expect(current().audio).toEqual(AUDIO)

    await user.click(screen.getByRole('button', { name: 'Hazır ses kaydı (isteğe bağlı): kaldır' }))
    expect(current()).not.toHaveProperty('audio')
  })

  it('fills the card with AI text and flags it for review', async () => {
    const { user, current } = renderStepEditor({
      ...sample('quiz'),
      aiGenerated: { fields: ['hint'] },
    })

    await user.click(screen.getByRole('button', { name: 'Yapay zekâyla yaz' }))

    const step = current()
    expect(step).toMatchObject({ type: 'quiz', title: 'Bitki nerede beslenir?' })
    expect(step.aiGenerated?.fields.toSorted()).toEqual([
      'answer',
      'celebration',
      'hint',
      'narration',
      'options',
      'title',
    ])
    expect(screen.getByText('Yapay zekâ içeriği · kontrol edin')).toBeInTheDocument()
  })

  it('offers no AI writing when the AI provider is off', () => {
    const { AiTextButton: _off, ...withoutAi } = SERVICES
    renderStepEditor(sample('quiz'), { services: withoutAi })

    expect(screen.queryByRole('button', { name: 'Yapay zekâyla yaz' })).not.toBeInTheDocument()
    expect(screen.queryByText('Yapay zekâ içeriği · kontrol edin')).not.toBeInTheDocument()
  })

  it('shows the publish issues of the card', () => {
    renderStepEditor(sample('tap-reveal'), {
      issues: [
        {
          severity: 'error',
          tab: 'kartlar',
          stepId: 's-bv-tap',
          field: 'title',
          message: 'Kart başlığı en az 3 karakter olmalı.',
        },
      ],
    })

    expect(
      screen.getByRole('textbox', { name: 'Soru / kart başlığı' }),
    ).toHaveAccessibleDescription('Kart başlığı en az 3 karakter olmalı.')
  })

  it('offers a visual slot only for blocks that show visuals', () => {
    renderStepEditor(sample('sequence'))

    expect(screen.queryByRole('heading', { name: 'Görsel alan' })).not.toBeInTheDocument()
  })

  it('stores the scene chosen for the card', async () => {
    const { user, current } = renderStepEditor(sample('tap-reveal'))

    await user.click(screen.getByRole('radio', { name: /^Sera/ }))

    expect(current()).toMatchObject({ visual: { kind: 'scene', sceneId: 'greenhouse' } })
  })

  it('stores the video link of a video card', async () => {
    const { user, current } = renderStepEditor(sample('video'))
    const link = screen.getByRole('textbox', { name: 'Video bağlantısı' })

    await user.clear(link)
    await user.click(link)
    await user.paste('https://youtu.be/dQw4w9WgXcQ')

    expect(current()).toMatchObject({
      visual: { kind: 'video', source: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } },
    })
  })

  describe('"Dinle"', () => {
    /** Like the browser's utterance: an event target that also calls its `on…` handlers. */
    class FakeUtterance extends EventTarget {
      text: string
      lang = ''
      rate = 1
      pitch = 1
      voice: unknown = null
      onend: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      constructor(text: string) {
        super()
        this.text = text
      }
      override dispatchEvent(event: Event) {
        if (event.type === 'end') this.onend?.(event)
        if (event.type === 'error') this.onerror?.(event)
        return super.dispatchEvent(event)
      }
    }

    it('reads the narration aloud and stops on the second press', async () => {
      const speak = vi.fn<(utterance: FakeUtterance) => void>()
      const cancel = vi.fn<() => void>()
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
      vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices: () => [] })
      const step = sample('tap-reveal')
      const { user } = renderStepEditor(step)

      await user.click(screen.getByRole('button', { name: 'Dinle' }))

      expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: step.narration }))
      expect(screen.getByRole('button', { name: 'Durdur' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Durdur' }))

      expect(cancel).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Dinle' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('returns to "Dinle" when reading ends', async () => {
      const speak = vi.fn<(utterance: FakeUtterance) => void>()
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
      vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn<() => void>(), getVoices: () => [] })
      const { user } = renderStepEditor(sample('tap-reveal'))

      await user.click(screen.getByRole('button', { name: 'Dinle' }))
      act(() => {
        speak.mock.calls[0]?.[0].dispatchEvent(new Event('end'))
      })

      expect(screen.getByRole('button', { name: 'Dinle' })).toBeInTheDocument()
    })

    it('is hidden when the browser cannot speak', () => {
      renderStepEditor(sample('tap-reveal'))

      expect(screen.queryByRole('button', { name: 'Dinle' })).not.toBeInTheDocument()
    })
  })
})
