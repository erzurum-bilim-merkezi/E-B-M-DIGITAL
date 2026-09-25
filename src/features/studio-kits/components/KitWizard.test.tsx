import { BLOK_VITRINI } from '@/entities/kit'
import { mockControl } from '@/shared/api/mock-db'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import { kitRepository, KitWizard, type AiKitDraftComponent } from '../index'

const {
  id: _id,
  slug: _slug,
  qrPrefix: _prefix,
  ...AI_DRAFT
} = {
  ...BLOK_VITRINI,
  title: 'Kutup Hayvanları',
  tagline: 'Soğukta yaşayan canlılar',
  description: 'Kutuplarda yaşayan hayvanları tanı.',
  category: 'earth' as const,
  ageRange: { min: 7, max: 11 },
  durationMinutes: 25,
  icon: { kind: 'emoji' as const, value: '🐧' },
}

const FakeAiDraft: AiKitDraftComponent = ({ onDrafted }) => (
  <button type="button" onClick={() => onDrafted(AI_DRAFT)}>
    Taslak oluştur
  </button>
)

function renderWizard({ ai = false }: { ai?: boolean } = {}) {
  const onCreated = vi.fn<(kitId: string) => void>()
  const view = renderWithProviders(
    <KitWizard onCreated={onCreated} AiDraft={ai ? FakeAiDraft : undefined} />,
  )
  return { ...view, onCreated }
}

function heading() {
  return screen.getByRole('heading', { level: 2 })
}

async function next(user: ReturnType<typeof renderWizard>['user']) {
  await user.click(screen.getByRole('button', { name: /^Devam/ }))
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('editor')
})

describe('KitWizard', () => {
  it('starts on the templates with the 7-card discovery kit selected', () => {
    renderWizard()

    expect(heading()).toHaveTextContent('Nasıl başlamak istersiniz?')
    const steps = screen.getByRole('list', { name: 'Sihirbaz adımları' })
    expect(within(steps).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
    const templates = screen.getByRole('radiogroup', { name: 'Şablonlar' })
    const discovery = within(templates).getByRole('radio', { name: /^7 kartlı keşif/ })
    expect(discovery).toHaveAttribute('aria-checked', 'true')
    expect(discovery).toHaveTextContent('7 kart')
    expect(within(templates).queryByRole('radio', { name: /Yapay zekâyla taslak/ })).toBeNull()
  })

  it('suggests a free address and QR prefix from the title', async () => {
    const { user } = renderWizard()
    await next(user)
    await waitFor(() => expect(heading()).toHaveFocus())
    expect(heading()).toHaveTextContent('Kitin adı')

    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))

    await user.paste('Küçük Çiftçiler')

    // "kucuk-ciftciler" and "KC" belong to the seeded kit.
    expect(screen.getByRole('textbox', { name: 'Adres' })).toHaveValue('kucuk-ciftciler-2')
    expect(screen.getByRole('textbox', { name: 'Adres' })).toHaveAccessibleDescription(
      'Kâşif’te: /kit/kucuk-ciftciler-2',
    )
    expect(screen.getByRole('textbox', { name: 'QR öneki' })).toHaveValue('KUC')
  })

  it('stops suggesting once the address and prefix were edited by hand', async () => {
    const { user } = renderWizard()
    await next(user)
    const title = screen.getByRole('textbox', { name: 'Kit adı' })
    await user.click(title)
    await user.paste('Mıknatıs')
    await user.clear(screen.getByRole('textbox', { name: 'Adres' }))
    await user.paste('kendi-adresim')
    await user.clear(screen.getByRole('textbox', { name: 'QR öneki' }))
    await user.type(screen.getByRole('textbox', { name: 'QR öneki' }), 'KA')

    await user.click(title)

    await user.paste(' Oyunu')

    expect(screen.getByRole('textbox', { name: 'Adres' })).toHaveValue('kendi-adresim')
    expect(screen.getByRole('textbox', { name: 'QR öneki' })).toHaveValue('KA')
  })

  it('needs a title of at least three letters', async () => {
    const { user } = renderWizard()
    await next(user)
    const title = screen.getByRole('textbox', { name: 'Kit adı' })

    await user.type(title, 'Ab')
    // Nothing is flagged before the step is submitted.
    expect(title).not.toHaveAttribute('aria-invalid')
    await next(user)

    // The error sits on the field (WCAG 3.3.1) and focus moves there.
    expect(screen.getByRole('alert')).toHaveTextContent('Kit adı en az 3 karakter olmalı.')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription('Kit adı en az 3 karakter olmalı.')
    expect(title).toHaveFocus()
    expect(heading()).toHaveTextContent('Kitin adı')
  })

  it('flags an address or prefix another kit uses', async () => {
    const { user } = renderWizard()
    await next(user)
    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))
    await user.paste('Mıknatıslar')
    const address = screen.getByRole('textbox', { name: 'Adres' })
    const prefix = screen.getByRole('textbox', { name: 'QR öneki' })

    await user.clear(address)
    await user.paste('blok-vitrini')
    await user.clear(prefix)
    await user.type(prefix, 'bv')
    await next(user)

    expect(address).toHaveAccessibleDescription(/Bu adres kullanılıyor\./)
    expect(prefix).toHaveAccessibleDescription(/Bu önek kullanılıyor\./)
    expect(address).toHaveAttribute('aria-invalid', 'true')
    expect(prefix).toHaveAttribute('aria-invalid', 'true')
    // The first invalid field gets focus; the step does not advance.
    expect(address).toHaveFocus()
    expect(heading()).toHaveTextContent('Kitin adı')
  })

  it('flags a malformed address or prefix', async () => {
    const { user } = renderWizard()
    await next(user)
    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))
    await user.paste('Mıknatıslar')
    const address = screen.getByRole('textbox', { name: 'Adres' })
    const prefix = screen.getByRole('textbox', { name: 'QR öneki' })

    await user.clear(address)
    await user.type(address, 'm')
    await user.clear(prefix)
    await user.type(prefix, 'M1')

    expect(address).toHaveAccessibleDescription(/Küçük harf, rakam ve tire kullanın\./)
    expect(prefix).toHaveValue('M')
    expect(prefix).toHaveAccessibleDescription(/2–4 büyük harf\./)
  })

  it('needs an address and a prefix', async () => {
    const { user } = renderWizard()
    await next(user)
    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))
    await user.paste('Mıknatıslar')
    const address = screen.getByRole('textbox', { name: 'Adres' })
    const prefix = screen.getByRole('textbox', { name: 'QR öneki' })

    await user.clear(address)
    expect(address).not.toHaveAttribute('aria-invalid')
    await next(user)

    expect(screen.getByRole('alert')).toHaveTextContent('Kitin adresini girin.')
    expect(address).toHaveAccessibleDescription(/Kitin adresini girin\./)
    expect(address).toBeRequired()
    expect(address).toHaveFocus()

    await user.type(address, 'miknatislar')
    await user.clear(prefix)
    await next(user)

    expect(screen.getByRole('alert')).toHaveTextContent('QR önekini girin.')
    expect(prefix).toHaveAttribute('aria-invalid', 'true')
    expect(prefix).toHaveFocus()
  })

  it('creates a kit from the chosen template with its details', async () => {
    const { user, onCreated } = renderWizard()
    await user.click(screen.getByRole('radio', { name: /^Quiz kiti/ }))
    await next(user)
    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))
    await user.paste('Mıknatıs Bilmecesi')
    await user.clear(screen.getByRole('textbox', { name: 'Kit ikonu' }))
    await user.paste('🧲')
    await next(user)

    expect(heading()).toHaveTextContent('Kiti tanıtın')
    await user.click(screen.getByRole('textbox', { name: 'Kısa açıklama' }))
    await user.paste('Neyi çeker?')
    await user.click(screen.getByRole('textbox', { name: /^Açıklama/ }))
    await user.paste('Mıknatıs deneyleri.')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kategori' }), 'Elektrik')
    const replace = async (name: string, value: string) => {
      const input = screen.getByRole('spinbutton', { name })
      await user.type(input, value, {
        initialSelectionStart: 0,
        initialSelectionEnd: (input.getAttribute('value') ?? '').length,
      })
    }
    // The ages are swapped on save when entered the wrong way round.
    await replace('En küçük yaş', '9')
    await replace('En büyük yaş', '7')
    await replace('Süre', '15')
    await user.click(screen.getByRole('button', { name: 'Oluştur ve kartları ekle' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    const kit = await kitRepository.get(onCreated.mock.calls[0]![0])
    expect(kit).toMatchObject({ slug: 'miknatis-bilmecesi', qrPrefix: 'MB', status: 'draft' })
    expect(kit.draft).toMatchObject({
      title: 'Mıknatıs Bilmecesi',
      tagline: 'Neyi çeker?',
      description: 'Mıknatıs deneyleri.',
      category: 'electricity',
      ageRange: { min: 7, max: 9 },
      durationMinutes: 15,
      icon: { kind: 'emoji', value: '🧲' },
    })
    expect(kit.draft.steps.map((step) => step.type)).toEqual([
      'info',
      'quiz',
      'quiz',
      'quiz',
      'sequence',
    ])
  })

  it('goes back to the previous step', async () => {
    const { user } = renderWizard()
    await next(user)

    await user.click(screen.getByRole('button', { name: 'Geri' }))

    expect(heading()).toHaveTextContent('Nasıl başlamak istersiniz?')
    expect(screen.queryByRole('button', { name: 'Geri' })).not.toBeInTheDocument()
  })

  it('shows why the kit could not be created', async () => {
    const { user, onCreated } = renderWizard()
    await next(user)
    await user.click(screen.getByRole('textbox', { name: 'Kit adı' }))
    await user.paste('Mıknatıslar')
    await next(user)
    mockControl.failNext('kits.create', 'conflict', 'Bu adres başka bir kitte kullanılıyor.')

    await user.click(screen.getByRole('button', { name: 'Oluştur ve kartları ekle' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu adres başka bir kitte kullanılıyor.',
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  describe('with the AI provider on', () => {
    it('needs a draft before continuing', async () => {
      const { user } = renderWizard({ ai: true })

      await user.click(screen.getByRole('radio', { name: /^Yapay zekâyla taslak/ }))
      await next(user)

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Önce yapay zekâ taslağını oluşturun ya da bir şablon seçin.',
      )
    })

    it('creates the kit from the AI draft under its own address and prefix', async () => {
      const { user, onCreated } = renderWizard({ ai: true })
      await user.click(screen.getByRole('radio', { name: /^Yapay zekâyla taslak/ }))
      await user.click(screen.getByRole('button', { name: 'Taslak oluştur' }))
      expect(screen.getByRole('status')).toHaveTextContent(
        `Taslak hazır: ${BLOK_VITRINI.steps.length} kart.`,
      )
      // Choosing the AI option again keeps the draft.
      await user.click(screen.getByRole('radio', { name: /^Yapay zekâyla taslak/ }))
      expect(screen.getByRole('status')).toBeInTheDocument()

      await next(user)
      expect(screen.getByRole('textbox', { name: 'Kit adı' })).toHaveValue('Kutup Hayvanları')
      expect(screen.getByRole('textbox', { name: 'Adres' })).toHaveValue('kutup-hayvanlari')
      expect(screen.getByRole('textbox', { name: 'QR öneki' })).toHaveValue('KH')
      expect(screen.getByRole('textbox', { name: 'Kit ikonu' })).toHaveValue('🐧')
      await next(user)
      expect(screen.getByRole('textbox', { name: 'Kısa açıklama' })).toHaveValue(
        'Soğukta yaşayan canlılar',
      )
      await user.click(screen.getByRole('button', { name: 'Oluştur ve kartları ekle' }))

      await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
      const kit = await kitRepository.get(onCreated.mock.calls[0]![0])
      expect(kit.draft).toMatchObject({
        id: kit.id,
        slug: 'kutup-hayvanlari',
        qrPrefix: 'KH',
        title: 'Kutup Hayvanları',
        category: 'earth',
        ageRange: { min: 7, max: 11 },
        durationMinutes: 25,
      })
      expect(kit.draft.steps).toHaveLength(BLOK_VITRINI.steps.length)
      expect(kit.draft.steps.every((step) => step.qrCode.startsWith('KH-'))).toBe(true)
    })
  })
})
