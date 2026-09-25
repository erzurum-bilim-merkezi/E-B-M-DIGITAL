import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { DEMO_ACCOUNTS } from '../api/demo-accounts'
import type { SignInResult } from '../api/port'
import { ChangePasswordForm } from './ChangePasswordForm'

const NEW_PASSWORD = 'Gunes.Isigi.2031'

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('editor')
})

function renderForm(requireCurrent: boolean) {
  const onResult = vi.fn<(result: SignInResult) => void>()
  const view = renderWithProviders(
    <ChangePasswordForm requireCurrent={requireCurrent} onResult={onResult} />,
  )
  const fill = async (current: string | null) => {
    if (current !== null) await view.user.type(screen.getByLabelText(/Mevcut parola/), current)
    await view.user.type(screen.getByLabelText(/^Yeni parola\s*\*?$/), NEW_PASSWORD)
    await view.user.type(screen.getByLabelText(/Yeni parola \(tekrar\)/), NEW_PASSWORD)
  }
  const save = () => view.user.click(screen.getByRole('button', { name: 'Parolayı kaydet' }))
  return { ...view, onResult, fill, save }
}

describe('ChangePasswordForm', () => {
  it('asks for the current password and links the error to the field', async () => {
    const { fill, save, onResult } = renderForm(true)

    await fill(null)
    await save()

    const current = screen.getByLabelText(/Mevcut parola/)
    expect(current).toHaveAttribute('aria-invalid', 'true')
    expect(current).toHaveAccessibleDescription('Mevcut parolanızı girin.')
    expect(onResult).not.toHaveBeenCalled()
  })

  it('reports a wrong current password and keeps what was typed', async () => {
    const { fill, save, onResult } = renderForm(true)

    await fill('yanlis-parola-1')
    await save()

    expect(await screen.findByText('Mevcut parola hatalı.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Mevcut parola/)).toHaveValue('yanlis-parola-1')
    expect(screen.getByLabelText(/Yeni parola \(tekrar\)/)).toHaveValue(NEW_PASSWORD)
    expect(onResult).not.toHaveBeenCalled()
  })

  it('saves with the right current password', async () => {
    const { fill, save, onResult } = renderForm(true)

    await fill(DEMO_ACCOUNTS.editor.password)
    await save()

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1))
    expect(onResult.mock.calls[0]?.[0].next).toBe('done')
  })

  it('does not ask for it after a temporary-password sign-in', () => {
    renderForm(false)

    expect(screen.queryByLabelText(/Mevcut parola/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Yeni parola \(tekrar\)/)).toBeInTheDocument()
  })
})
