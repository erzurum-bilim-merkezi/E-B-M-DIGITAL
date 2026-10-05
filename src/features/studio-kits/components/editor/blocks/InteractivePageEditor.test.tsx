import { useState, type ReactNode } from 'react'

import {
  BLOK_VITRINI,
  PAGE_PROBLEM_MESSAGES,
  PAGE_URL_MESSAGES,
  samplePageHtml,
  type InteractivePageStep,
  type KitDocument,
  type Step,
} from '@/entities/kit'
import { renderWithProviders, screen } from '@/test/test-utils'

import { useEditorServices, type AiPageDraftProps } from '../editor-services'
import { EditorServicesProvider } from '../services'
import { BlockFieldsEditor } from './registry'

const CARD = BLOK_VITRINI.steps.find(
  (step): step is InteractivePageStep => step.type === 'interactive-page',
)
const DRAFTED = samplePageHtml('Satürn')

function card(): InteractivePageStep {
  if (!CARD) throw new Error('Blok Vitrini has no interactive-page card')
  return { ...CARD, source: { kind: 'html', prompt: '', html: '' } }
}

function FakeAiPageDraft({ onDrafted, hasPage, ageRange }: AiPageDraftProps) {
  return (
    <>
      <p>{ageRange ? `Yaş ${ageRange.min}–${ageRange.max}` : 'Yaş sorulur'}</p>
      <button
        type="button"
        onClick={() =>
          onDrafted({
            title: 'Satürn',
            html: DRAFTED,
            prompt: 'Halkalı Satürn',
            ageRange: { min: 7, max: 10 },
          })
        }
      >
        {hasPage ? 'Yeniden tasarla' : 'Sayfayı tasarla'}
      </button>
    </>
  )
}

function WithAi({ children }: { children: ReactNode }) {
  const services = useEditorServices()
  return (
    <EditorServicesProvider value={{ ...services, AiPageDraft: FakeAiPageDraft }}>
      {children}
    </EditorServicesProvider>
  )
}

function Harness({
  initial,
  onStep,
  kit,
}: {
  initial: Step
  onStep: (step: Step) => void
  kit?: KitDocument
}) {
  const [step, setStep] = useState(initial)
  return (
    <BlockFieldsEditor
      step={step}
      onChange={(next) => {
        onStep(next)
        setStep(next)
      }}
      issueFor={() => undefined}
      kit={kit}
    />
  )
}

function renderEditor({
  ai = true,
  step = card(),
  kit,
}: { ai?: boolean; step?: Step; kit?: KitDocument } = {}) {
  const changes: Step[] = []
  const harness = <Harness initial={step} onStep={(next) => changes.push(next)} kit={kit} />
  const view = renderWithProviders(ai ? <WithAi>{harness}</WithAi> : harness)
  const latest = () => {
    const last = changes.at(-1)
    if (last?.type !== 'interactive-page') throw new Error('The editor changed the card type')
    return last
  }
  return { ...view, latest }
}

describe('InteractivePageEditor', () => {
  it('drafts the page with AI, marks it as AI content and previews it', async () => {
    const { user, latest } = renderEditor()

    expect(screen.getByText('Sayfa tasarlanınca burada görünecek.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sayfayı tasarla' }))

    expect(latest().source).toEqual({ kind: 'html', prompt: 'Halkalı Satürn', html: DRAFTED })
    expect(latest().aiGenerated).toEqual({ fields: ['page'] })
    expect(screen.getByRole('button', { name: 'Yeniden tasarla' })).toBeInTheDocument()
    // The preview follows the page once it settles.
    expect(await screen.findByTitle(`Önizleme: ${card().title}`)).toHaveAttribute(
      'sandbox',
      'allow-scripts',
    )
  })

  it('keeps the page when trying a link and back', async () => {
    const { user, latest } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Sayfayı tasarla' }))

    await user.click(screen.getByRole('radio', { name: 'Hazır bağlantı' }))
    expect(latest().source).toEqual({ kind: 'url', url: '' })
    expect(latest().aiGenerated).toBeUndefined()

    await user.click(screen.getByRole('radio', { name: /^Sayfa \(/ }))
    expect(latest().source).toMatchObject({ kind: 'html', html: DRAFTED })
    expect(latest().aiGenerated).toEqual({ fields: ['page'] })
  })

  it('checks a link as it is typed', async () => {
    const { user, latest } = renderEditor()
    await user.click(screen.getByRole('radio', { name: 'Hazır bağlantı' }))
    const link = screen.getByRole('textbox', { name: /^Sayfanın bağlantısı/ })

    await user.type(link, 'http://ornek.org')
    expect(link).toHaveAccessibleDescription(
      expect.stringContaining(PAGE_URL_MESSAGES['not-https']),
    )
    await user.clear(link)
    await user.type(link, 'https://ornek.org/sim')

    expect(latest().source).toEqual({ kind: 'url', url: 'https://ornek.org/sim' })
    expect(screen.getByRole('button', { name: 'Sayfayı önizle' })).toBeInTheDocument()
  })

  it('lets the HTML be edited by hand and says why it would not pass', async () => {
    const { user, latest } = renderEditor({ ai: false })

    expect(screen.getByText(/Yapay zekâ kapalı/)).toBeInTheDocument()
    await user.click(screen.getByText('HTML’i düzenle (ileri düzey)'))
    const html = screen.getByRole('textbox', { name: 'Sayfanın HTML’i' })
    await user.click(html)
    await user.paste('<html><body><script>fetch("/veri")</script></body></html>')

    expect(latest().source).toMatchObject({ kind: 'html', html: expect.stringContaining('fetch') })
    // Announced politely while typing (a status, not an alert).
    expect(screen.getByText(PAGE_PROBLEM_MESSAGES.network)).toBeInTheDocument()
    expect(html).toHaveAttribute('aria-invalid', 'true')
  })

  it('designs for the kit’s ages and keeps the kit’s pages within their shared budget', async () => {
    const own = card()
    // Other cards of the kit already hold almost all the room pages share.
    const others = Array.from({ length: 6 }, (_, index) => ({
      ...own,
      id: `s-dolu-${index}`,
      source: { kind: 'html' as const, prompt: '', html: 'x'.repeat(39_700) },
    }))
    const kit = { ...BLOK_VITRINI, ageRange: { min: 9, max: 12 }, steps: [own, ...others] }
    const { user, latest } = renderEditor({ kit })

    expect(screen.getByText('Yaş 9–12')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sayfayı tasarla' }))

    expect(screen.getByRole('alert')).toHaveTextContent('toplam boyut sınırını aşıyor')
    expect(() => latest()).toThrow('The editor changed the card type')
  })

  it('edits the instructions shown above the page', async () => {
    const { user, latest } = renderEditor()
    const instructions = screen.getByRole('textbox', { name: /^Çocuğa yönerge/ })

    await user.clear(instructions)
    await user.type(instructions, 'Halkalara dokun!')

    expect(latest().instructions).toBe('Halkalara dokun!')
  })
})
