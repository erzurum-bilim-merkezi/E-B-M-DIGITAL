import { KUCUK_CIFTCILER, type KitIssue } from '@/entities/kit'
import { renderWithProviders, screen, within } from '@/test/test-utils'

import { ValidationPanel } from './ValidationPanel'

const [firstStep] = KUCUK_CIFTCILER.steps

const TITLE_ERROR: KitIssue = {
  severity: 'error',
  tab: 'genel',
  field: 'title',
  message: 'Kit adı en az 3 karakter olmalı.',
}
const CARD_ERROR: KitIssue = {
  severity: 'error',
  tab: 'kartlar',
  stepId: firstStep!.id,
  field: 'answer',
  message: 'Cevap metni boş.',
}
const BADGE_WARNING: KitIssue = {
  severity: 'warning',
  tab: 'rozet',
  field: 'badge.name',
  message: 'Rozet adı kısa.',
}

function renderPanel(issues: KitIssue[], compact = false) {
  const onGo = vi.fn<(issue: KitIssue) => void>()
  const view = renderWithProviders(
    <ValidationPanel issues={issues} draft={KUCUK_CIFTCILER} onGo={onGo} compact={compact} />,
  )
  return { ...view, onGo }
}

describe('ValidationPanel', () => {
  it('says the kit is ready when there are no issues', () => {
    renderPanel([])

    expect(screen.getByRole('status')).toHaveTextContent('Yayına hazır: sorun bulunmadı.')
  })

  it('lists errors before warnings, labelled with their card or tab', () => {
    renderPanel([BADGE_WARNING, CARD_ERROR, TITLE_ERROR])

    expect(screen.getByText('2 sorun yayını engelliyor')).toBeInTheDocument()
    expect(screen.getByText('· 1 uyarı')).toBeInTheDocument()
    const rows = within(screen.getByRole('region', { name: 'Doğrulama' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining(`Cevap metni boş.Kart 1: ${firstStep!.title}`),
      expect.stringContaining('Kit adı en az 3 karakter olmalı.Genel'),
      expect.stringContaining('Rozet adı kısa.Rozet'),
    ])
    expect(within(rows[0]!).getByLabelText('Hata')).toBeInTheDocument()
    expect(within(rows[2]!).getByLabelText('Uyarı')).toBeInTheDocument()
  })

  it('reports that only warnings remain', () => {
    renderPanel([BADGE_WARNING])

    expect(screen.getByText('Yayını engelleyen sorun yok')).toBeInTheDocument()
  })

  it('falls back to the tab name when the card no longer exists', () => {
    renderPanel([{ ...CARD_ERROR, stepId: 's-silinmis' }])

    expect(screen.getByRole('listitem')).toHaveTextContent('Cevap metni boş.Kartlar')
  })

  it('jumps to the field of an issue with "Git"', async () => {
    const { user, onGo } = renderPanel([TITLE_ERROR, CARD_ERROR])

    await user.click(screen.getByRole('button', { name: 'Git: Cevap metni boş.' }))

    expect(onGo).toHaveBeenCalledWith(CARD_ERROR)
  })

  it('shows at most six issues in compact mode and counts the rest', () => {
    const issues = Array.from({ length: 8 }, (_, index) => ({
      ...BADGE_WARNING,
      message: `Uyarı ${index + 1}`,
    }))

    renderPanel(issues, true)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText('+2 sorun daha (Yayın sekmesinde tüm liste)')).toBeInTheDocument()
  })
})
