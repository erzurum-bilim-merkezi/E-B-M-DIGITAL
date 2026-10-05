import { checkPageHtml } from '@/entities/kit'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { FAKE_TRIGGERS } from '../api/fake-provider'
import { AiPageDraftForm, type AiPageDraftProps } from './AiPageDraft'

type Drafted = Parameters<AiPageDraftProps['onDrafted']>[0]

function renderForm(props: Partial<AiPageDraftProps> = {}) {
  const onDrafted = vi.fn<(draft: Drafted) => void>()
  const onSubmit = vi.fn<() => void>()
  const view = renderWithProviders(
    // Inside a form, like the kit wizard: the panel must never submit it.
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <AiPageDraftForm title="" hasPage={false} onDrafted={onDrafted} {...props} />
    </form>,
  )
  return { ...view, onDrafted, onSubmit }
}

beforeEach(async () => {
  localStorage.setItem('kasif:mock:ai-delay', '0')
  await seedMockBackend(MINIMAL_SEED)
  signInAs('editor')
})

describe('AiPageDraftForm', () => {
  it('designs a checked page for the ages asked and hands back what was asked', async () => {
    const { user, onDrafted } = renderForm()
    await user.type(screen.getByRole('textbox', { name: /^Sayfada ne olsun\?/ }), 'Dünya ve Ay')
    const youngest = screen.getByRole('spinbutton', { name: 'En küçük yaş' })
    // Typed freely: "1" on its way to "12" is not clamped to 3.
    await user.clear(youngest)
    await user.type(youngest, '12')
    await user.click(screen.getByRole('button', { name: 'Sayfayı tasarla' }))

    await waitFor(() => expect(onDrafted).toHaveBeenCalledOnce())
    const draft = onDrafted.mock.calls[0]?.[0]
    expect(draft).toMatchObject({ prompt: 'Dünya ve Ay', ageRange: { min: 10, max: 12 } })
    expect(checkPageHtml(draft?.html ?? '')).toEqual([])
  })

  it('never submits the form around it on Enter', async () => {
    const { user, onSubmit } = renderForm()

    await user.type(screen.getByRole('spinbutton', { name: 'En büyük yaş' }), '{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('asks no ages when the kit already has them', () => {
    renderForm({ ageRange: { min: 8, max: 11 }, hasPage: true, initialPrompt: 'Satürn' })

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Sayfada ne olsun\?/ })).toHaveValue('Satürn')
    expect(screen.getByRole('button', { name: 'Yeniden tasarla' })).toBeInTheDocument()
  })

  it('explains a page the check rejected and offers to try again', async () => {
    const { user, onDrafted } = renderForm()
    // Pasted: user.type would read the trigger's brackets as key names.
    await user.click(screen.getByRole('textbox', { name: /^Sayfada ne olsun\?/ }))
    await user.paste(`Ay ${FAKE_TRIGGERS.malicious}`)
    await user.click(screen.getByRole('button', { name: 'Sayfayı tasarla' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('güvenlik kontrolünden geçemedi')
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
    expect(onDrafted).not.toHaveBeenCalled()
  })
})
