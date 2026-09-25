import { useState } from 'react'

import { renderWithProviders, screen } from '@/test/test-utils'

import { NumberField, StringListField } from './fields'

function Materials({ initial }: { initial: string[] }) {
  const [values, setValues] = useState(initial)
  return (
    <StringListField
      id="materials"
      label="Malzeme"
      values={values}
      onChange={setValues}
      max={5}
      maxLength={40}
      addLabel="Malzeme ekle"
    />
  )
}

describe('NumberField', () => {
  it('labels the input and announces its description and unit', () => {
    renderWithProviders(
      <NumberField
        label="Süre"
        description="Kitin tahmini süresi."
        suffix="dk"
        value={20}
        min={1}
        max={180}
        onChange={() => undefined}
      />,
    )

    const input = screen.getByRole('spinbutton', { name: 'Süre' })
    expect(input).toHaveValue(20)
    expect(input).toHaveAccessibleDescription('Kitin tahmini süresi. dk')
  })

  it('keeps typed values inside the allowed range', async () => {
    const onChange = vi.fn<(value: number) => void>()
    const { user } = renderWithProviders(
      <NumberField label="En küçük yaş" value={5} min={3} max={14} onChange={onChange} />,
    )

    await user.type(screen.getByRole('spinbutton', { name: 'En küçük yaş' }), '9')

    expect(onChange).toHaveBeenLastCalledWith(14)
  })
})

describe('StringListField', () => {
  it('moves and deletes rows together with their inputs', async () => {
    const { user } = renderWithProviders(<Materials initial={['Tohum', 'Toprak', 'Su']} />)
    const water = screen.getByRole('textbox', { name: 'Malzeme 3' })

    await user.click(screen.getByRole('button', { name: 'Su yukarı taşı' }))
    expect(screen.getByRole('textbox', { name: 'Malzeme 2' })).toBe(water)
    expect(water).toHaveValue('Su')

    const soil = screen.getByRole('textbox', { name: 'Malzeme 3' })
    await user.click(screen.getByRole('button', { name: 'Tohum sil' }))
    expect(screen.getByRole('textbox', { name: 'Malzeme 1' })).toBe(water)
    expect(screen.getByRole('textbox', { name: 'Malzeme 2' })).toBe(soil)
    expect(soil).toHaveValue('Toprak')
  })

  it('keeps the first row in place and says so when moved further up', async () => {
    const { user } = renderWithProviders(<Materials initial={['Tohum', 'Toprak']} />)
    const up = screen.getByRole('button', { name: 'Tohum yukarı taşı' })
    expect(up).toHaveAttribute('aria-disabled', 'true')

    up.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('textbox', { name: 'Malzeme 1' })).toHaveValue('Tohum')
    expect(up).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('“Tohum” zaten ilk sırada.')
  })

  it('focuses "add" after the only row is deleted', async () => {
    const { user } = renderWithProviders(<Materials initial={['Tohum']} />)

    await user.click(screen.getByRole('button', { name: 'Tohum sil' }))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Malzeme ekle' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('“Tohum” silindi.')
  })

  it('adds an empty row that can be filled in', async () => {
    const { user } = renderWithProviders(<Materials initial={['Tohum']} />)

    await user.click(screen.getByRole('button', { name: 'Malzeme ekle' }))
    await user.type(screen.getByRole('textbox', { name: 'Malzeme 2' }), 'Saksı')

    expect(screen.getByRole('textbox', { name: 'Malzeme 1' })).toHaveValue('Tohum')
    expect(screen.getByRole('textbox', { name: 'Malzeme 2' })).toHaveValue('Saksı')
  })
})
