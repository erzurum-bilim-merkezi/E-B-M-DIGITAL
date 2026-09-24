import { renderWithProviders, screen } from '@/test/test-utils'

import { CodeEntry } from './CodeEntry'

const input = () => screen.getByRole('textbox', { name: 'Kodu yaz' })

describe('CodeEntry', () => {
  it('formats the code like the label while the child types', async () => {
    const { user } = renderWithProviders(<CodeEntry onSubmit={vi.fn<(code: string) => void>()} />)

    await user.type(input(), 'kc01')

    expect(input()).toHaveValue('KC-01')
    expect(input()).toHaveAccessibleDescription('Etiketin altındaki kodu yaz (ör. KC-01)')
  })

  it('submits the normalised code with Enter and with the "Aç" button', async () => {
    const onSubmit = vi.fn<(code: string) => void>()
    const { user } = renderWithProviders(<CodeEntry onSubmit={onSubmit} />)

    await user.type(input(), 'kc4{Enter}')
    expect(onSubmit).toHaveBeenLastCalledWith('KC-04')

    await user.clear(input())
    await user.type(input(), 'kc')
    await user.click(screen.getByRole('button', { name: 'Aç' }))
    expect(onSubmit).toHaveBeenLastCalledWith('KC')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('explains an invalid code, keeps what was typed and does not submit', async () => {
    const onSubmit = vi.fn<(code: string) => void>()
    const { user } = renderWithProviders(<CodeEntry onSubmit={onSubmit} />)

    await user.type(input(), 'k1{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu kod doğru görünmüyor. Etiketteki kodu kontrol et (ör. KC-01).',
    )
    expect(input()).toHaveValue('K-1')
    expect(input()).toBeInvalid()
    expect(input()).toHaveAccessibleDescription(/Bu kod doğru görünmüyor/)
    expect(input()).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(input(), '2')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for the code when submitted empty', async () => {
    const onSubmit = vi.fn<(code: string) => void>()
    const { user } = renderWithProviders(<CodeEntry onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Aç' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Önce etiketteki kodu yaz.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows the page's error until the child changes the code", async () => {
    const { user } = renderWithProviders(
      <CodeEntry
        onSubmit={vi.fn<(code: string) => void>()}
        defaultValue="xx-99"
        error="Bu kod bulunamadı."
      />,
    )

    expect(input()).toHaveValue('XX-99')
    expect(screen.getByRole('alert')).toHaveTextContent('Bu kod bulunamadı.')

    await user.type(input(), '{Backspace}')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
