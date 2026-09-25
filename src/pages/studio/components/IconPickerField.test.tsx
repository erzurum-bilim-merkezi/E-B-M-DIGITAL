import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { KitIcon } from '@/entities/kit'
import { renderWithProviders } from '@/test/test-utils'

import { IconPickerField } from './IconPickerField'

function renderPicker() {
  const onChange = vi.fn<(icon: KitIcon) => void>()
  const view = renderWithProviders(
    <IconPickerField
      id="card-icon"
      label="Kart ikonu"
      value={{ kind: 'emoji', value: '🌍' }}
      onChange={onChange}
    />,
  )
  return { ...view, onChange }
}

describe('IconPickerField', () => {
  it('picks an emoji from the space set', async () => {
    const { user, onChange } = renderPicker()

    await user.click(screen.getByRole('button', { name: 'Kart ikonu' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Uzay' })).getByRole('option', { name: '🔴' }),
    )

    expect(onChange).toHaveBeenCalledWith({ kind: 'emoji', value: '🔴' })
  })

  it('takes any emoji typed into “Başka bir emoji”', async () => {
    const { user, onChange } = renderPicker()

    await user.click(screen.getByRole('button', { name: 'Kart ikonu' }))
    await user.type(screen.getByRole('textbox', { name: 'Başka bir emoji' }), '💍')
    await user.click(screen.getByRole('button', { name: 'Kullan' }))

    expect(onChange).toHaveBeenCalledWith({ kind: 'emoji', value: '💍' })
  })

  it('rejects words and keeps the picker open with an error on the field', async () => {
    const { user, onChange } = renderPicker()

    await user.click(screen.getByRole('button', { name: 'Kart ikonu' }))
    const field = screen.getByRole('textbox', { name: 'Başka bir emoji' })
    await user.type(field, 'uzay{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Tek bir emoji yazın ya da yapıştırın.')
  })
})
