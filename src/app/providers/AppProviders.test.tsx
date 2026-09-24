import { useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AppProviders } from './AppProviders'

function QueryClientProbe() {
  useQueryClient() // throws if no QueryClientProvider is mounted
  return <p>query client ready</p>
}

let shouldThrow = true

function Unstable() {
  if (shouldThrow) throw new Error('render failed')
  return <p>recovered</p>
}

describe('AppProviders', () => {
  it('provides a QueryClient to the tree', () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>,
    )

    expect(screen.getByText('query client ready')).toBeInTheDocument()
  })

  it('catches render errors and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    shouldThrow = true

    render(
      <AppProviders>
        <Unstable />
      </AppProviders>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Beklenmeyen bir hata oluştu')
    expect(screen.getByText('render failed')).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})
