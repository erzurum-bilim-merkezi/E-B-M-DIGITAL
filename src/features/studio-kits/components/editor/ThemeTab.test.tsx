import { useState } from 'react'

import { contrastRatio, KUCUK_CIFTCILER, type KitDocument } from '@/entities/kit'
import { renderWithProviders, screen, within } from '@/test/test-utils'

import { BadgeTab, ThemeTab } from './ThemeTab'

type Update = (mutator: (current: KitDocument) => KitDocument) => void

function Harness({
  initial,
  onDraft,
  render,
}: {
  initial: KitDocument
  onDraft: (draft: KitDocument) => void
  render: (draft: KitDocument, update: Update) => React.ReactNode
}) {
  const [draft, setDraft] = useState(initial)
  return render(draft, (mutator) => {
    const next = mutator(draft)
    onDraft(next)
    setDraft(next)
  })
}

function renderTab(
  render: (draft: KitDocument, update: Update) => React.ReactNode,
  initial: KitDocument = KUCUK_CIFTCILER,
) {
  const drafts: KitDocument[] = []
  const view = renderWithProviders(
    <Harness initial={initial} onDraft={(draft) => drafts.push(draft)} render={render} />,
  )
  return { ...view, current: () => drafts.at(-1) ?? initial }
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderTheme(initial?: KitDocument) {
  return renderTab((draft, update) => <ThemeTab draft={draft} update={update} />, initial)
}

function renderBadge(issues: Partial<Record<string, string>> = {}) {
  return renderTab((draft, update) => (
    <BadgeTab draft={draft} update={update} issueFor={(field) => issues[field]} />
  ))
}

describe('ThemeTab', () => {
  it('picks a theme preset', async () => {
    const { user, current } = renderTheme()
    const presets = screen.getByRole('radiogroup', { name: 'Tema ön ayarı' })
    expect(within(presets).getByRole('radio', { name: 'Çayır' })).toBeChecked()

    await user.click(within(presets).getByRole('radio', { name: 'Okyanus' }))

    expect(current().theme.preset).toBe('ocean')
    expect(within(presets).getByRole('radio', { name: 'Okyanus' })).toBeChecked()
  })

  it('saves an accent color with enough contrast for white text', async () => {
    const { user, current } = renderTheme()
    const accent = screen.getByRole('textbox', { name: 'Vurgu rengi (isteğe bağlı)' })

    await user.type(accent, '#1D4ED8')

    expect(current().theme.accent).toBe('#1d4ed8')
    expect(accent).toBeValid()
    expect(accent).toHaveAccessibleDescription(
      new RegExp(`Kontrast ${contrastRatio('#ffffff', '#1D4ED8').toFixed(2)}:1 — uygun \\(AA\\)`),
    )
  })

  it('does not save an accent color below AA contrast', async () => {
    const { user, current } = renderTheme()
    const accent = screen.getByRole('textbox', { name: 'Vurgu rengi (isteğe bağlı)' })

    await user.type(accent, '#FACC15')

    expect(current().theme).not.toHaveProperty('accent')
    expect(accent).toBeInvalid()
    expect(screen.getByRole('status')).toHaveTextContent(/yetersiz; kaydedilmedi/)
  })

  it('explains the expected color format', async () => {
    const { user, current } = renderTheme()
    const accent = screen.getByRole('textbox', { name: 'Vurgu rengi (isteğe bağlı)' })

    await user.type(accent, '#12')

    expect(screen.getByRole('status')).toHaveTextContent('Renk #RRGGBB biçiminde olmalı.')
    expect(accent).toBeInvalid()
    expect(current().theme).not.toHaveProperty('accent')
  })

  it('goes back to the preset accent', async () => {
    const { user, current } = renderTheme({
      ...KUCUK_CIFTCILER,
      theme: { ...KUCUK_CIFTCILER.theme, accent: '#1d4ed8' },
    })

    await user.click(screen.getByRole('button', { name: 'Ön ayar rengine dön' }))

    expect(current().theme).not.toHaveProperty('accent')
    expect(screen.getByRole('textbox', { name: 'Vurgu rengi (isteğe bağlı)' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Ön ayar rengine dön' })).not.toBeInTheDocument()
  })

  it('sets the font', async () => {
    const { user, current } = renderTheme()

    await user.click(screen.getByRole('radio', { name: /^Standart/ }))
    expect(current().theme.font).toBe('standard')

    await user.click(screen.getByRole('radio', { name: /^Oyunsu/ }))
    expect(current().theme.font).toBe('playful')
  })

  it.each([
    ['Sakin', 'calm'],
    ['Minimal', 'minimal'],
  ] as const)('sets the motion level to %s', async (label, motion) => {
    const { user, current } = renderTheme()

    await user.click(screen.getByRole('radio', { name: new RegExp(`^${label}`) }))

    expect(current().theme.motion).toBe(motion)
  })

  it('sets the motion level back to full', async () => {
    const { user, current } = renderTheme({
      ...KUCUK_CIFTCILER,
      theme: { ...KUCUK_CIFTCILER.theme, motion: 'calm' },
    })

    await user.click(screen.getByRole('radio', { name: /^Tam/ }))

    expect(current().theme.motion).toBe('full')
  })
})

describe('BadgeTab', () => {
  it('edits the badge name, description and color', async () => {
    const { user, current } = renderBadge()

    await user.clear(screen.getByRole('textbox', { name: 'Rozet adı' }))
    await user.type(screen.getByRole('textbox', { name: 'Rozet adı' }), 'Sera Ustası')
    await user.clear(screen.getByRole('textbox', { name: 'Rozet açıklaması' }))
    await user.type(screen.getByRole('textbox', { name: 'Rozet açıklaması' }), 'Tebrikler!')
    await user.click(
      within(screen.getByRole('group', { name: 'Rozet rengi' })).getByRole('radio', {
        name: 'Mor',
      }),
    )

    expect(current().badge).toMatchObject({
      name: 'Sera Ustası',
      description: 'Tebrikler!',
      color: 'purple',
    })
  })

  it('falls back to a medal when the emoji is cleared', async () => {
    const { user, current } = renderBadge()

    await user.clear(screen.getByRole('textbox', { name: 'Rozet simgesi' }))

    expect(current().badge.emoji).toBe('🏅')
  })

  it('picks an emoji from the quick list', async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    const { user, current } = renderBadge()

    await user.click(screen.getByRole('button', { name: 'Rozet simgesi: emoji seç' }))
    const emojis = await screen.findByRole('listbox', { name: 'Emojiler' })
    await user.click(within(emojis).getByRole('option', { name: '🏆' }))

    expect(current().badge.emoji).toBe('🏆')
  })

  it('shows the badge name issue', () => {
    renderBadge({ 'badge.name': 'Rozet adı boş.' })

    expect(screen.getByRole('textbox', { name: 'Rozet adı' })).toHaveAccessibleDescription(
      'Rozet adı boş.',
    )
  })
})
