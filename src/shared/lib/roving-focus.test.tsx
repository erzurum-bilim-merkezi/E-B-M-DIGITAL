import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { handleRovingKeys, rovingTabIndex } from './roving-focus'

const OPTIONS = ['Çayır', 'Uzay', 'Okyanus']

function CardRadios() {
  const [value, setValue] = useState<string | null>(null)
  const selected = OPTIONS.findIndex((option) => option === value)
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- test double of a card radio group
      role="radiogroup"
      tabIndex={-1}
      aria-label="Tema"
      onKeyDown={(event) => handleRovingKeys(event, { selector: '[role="radio"]', activate: true })}
    >
      {OPTIONS.map((option, index) => (
        <button
          key={option}
          type="button"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- test double of a card radio
          role="radio"
          aria-checked={value === option}
          tabIndex={rovingTabIndex(index, selected)}
          onClick={() => setValue(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

describe('roving focus (APG radio group)', () => {
  it('is one tab stop: the selected radio, or the first when none is selected', () => {
    expect(rovingTabIndex(0, -1)).toBe(0)
    expect(rovingTabIndex(1, -1)).toBe(-1)
    expect(rovingTabIndex(2, 2)).toBe(0)
    expect(rovingTabIndex(0, 2)).toBe(-1)
  })

  it('moves and selects with the arrow keys, wraps, and jumps with Home/End', async () => {
    const user = userEvent.setup()
    render(<CardRadios />)

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Çayır' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Uzay' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Uzay' })).toBeChecked()

    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Okyanus' })).toBeChecked()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Çayır' })).toBeChecked() // wraps around

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Okyanus' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'Çayır' })).toBeChecked()
  })

  it('ignores other keys and keeps Tab leaving the group', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CardRadios />
        <button type="button">Sonraki</button>
      </>,
    )

    await user.tab()
    await user.keyboard('a')
    expect(screen.getByRole('radio', { name: 'Çayır' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Sonraki' })).toHaveFocus()
  })
})
