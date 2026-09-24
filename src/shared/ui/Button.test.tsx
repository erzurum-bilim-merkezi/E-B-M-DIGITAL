import { renderWithProviders, screen } from '@/test/test-utils'

import { Button } from './Button'

describe('Button', () => {
  it('defaults to type="button" so it never submits forms by accident', () => {
    renderWithProviders(<Button>Kaydet</Button>)

    expect(screen.getByRole('button', { name: 'Kaydet' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick when clicked and not when disabled', async () => {
    const onClick = vi.fn<() => void>()
    const { user, rerender } = renderWithProviders(<Button onClick={onClick}>Kaydet</Button>)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()

    rerender(
      <Button onClick={onClick} disabled>
        Kaydet
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('lets className override variant styles', () => {
    renderWithProviders(<Button className="bg-black">X</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-black')
    expect(button).not.toHaveClass('bg-primary')
  })
})
