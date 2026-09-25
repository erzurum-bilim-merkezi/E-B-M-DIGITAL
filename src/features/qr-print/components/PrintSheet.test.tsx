import { renderWithProviders, screen, within } from '@/test/test-utils'

import { PrintSheet, type PrintLabel } from './PrintSheet'

const SITE = 'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/'

function makeCards(count: number): PrintLabel[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const code = `KC-${String(number).padStart(2, '0')}`
    return {
      code,
      url: `${SITE}?q=${code}`,
      title: `Kart başlığı ${number}`,
      caption: `Kart ${number}`,
      iconEmoji: '🌱',
    }
  })
}

const kitLabel: PrintLabel = {
  code: 'KC',
  url: `${SITE}?q=KC`,
  title: 'Küçük Çiftçiler',
  caption: 'Kit kodu',
}

const pages = () => screen.getAllByRole('region', { name: /^Sayfa/ })
const page = (index: number) => {
  const found = pages()[index]
  if (!found) throw new Error(`Page ${index + 1} is missing`)
  return found
}

describe('PrintSheet', () => {
  it('prints ten business cards per A4 page with every code', () => {
    const { rerender } = renderWithProviders(
      <PrintSheet template="card" labels={makeCards(8)} kitTitle="Küçük Çiftçiler" />,
    )

    expect(pages()).toHaveLength(1)
    expect(page(0)).toHaveAccessibleName('Sayfa 1 / 1')

    const cards = makeCards(11)
    rerender(<PrintSheet template="card" labels={cards} kitTitle="Küçük Çiftçiler" />)

    expect(pages()).toHaveLength(2)
    expect(within(page(0)).getAllByRole('listitem')).toHaveLength(10)
    expect(within(page(1)).getAllByRole('listitem')).toHaveLength(1)
    for (const card of cards) {
      expect(screen.getByText(card.code)).toBeInTheDocument()
      expect(screen.getByRole('img', { name: `${card.code} QR kodu` })).toBeInTheDocument()
    }
    expect(within(page(0)).getByText('Kart başlığı 1')).toBeInTheDocument()
    expect(within(page(0)).getAllByText('Kâşif ile okut')).toHaveLength(10)
  })

  it('adds a back page after each card page when a back note is given', () => {
    renderWithProviders(
      <PrintSheet
        template="card"
        labels={makeCards(3)}
        kitTitle="Küçük Çiftçiler"
        backNote="Bu kart Erzurum Bilim Merkezi'ne aittir."
      />,
    )

    expect(pages()).toHaveLength(2)
    expect(page(0)).toHaveAccessibleName('Sayfa 1 / 2')
    expect(page(1)).toHaveAccessibleName('Sayfa 2 / 2, arka yüz')
    expect(within(page(1)).getByText(/Kartların arka yüzü/)).toHaveTextContent(
      "Kartların arka yüzü: Bu kart Erzurum Bilim Merkezi'ne aittir.",
    )
  })

  it('lays equipment labels out in the configured columns × rows', () => {
    const labels = makeCards(7)
    renderWithProviders(
      <PrintSheet
        template="label"
        labels={labels}
        labelSizeMm={40}
        columns={3}
        rows={2}
        kitTitle="Küçük Çiftçiler"
      />,
    )

    expect(pages()).toHaveLength(2)
    expect(within(page(0)).getAllByRole('listitem')).toHaveLength(6)
    expect(within(page(1)).getAllByRole('listitem')).toHaveLength(1)
    for (const label of labels) expect(screen.getByText(label.code)).toBeInTheDocument()
    expect(screen.queryByText(/sığmıyor/)).not.toBeInTheDocument()
  })

  it('fills the A4 sheet by default and warns when a custom grid does not fit', () => {
    const { rerender } = renderWithProviders(
      <PrintSheet template="label" labels={makeCards(16)} kitTitle="Küçük Çiftçiler" />,
    )

    // 50 mm labels, 10 mm margins and 5 mm gaps: 3 × 5 per page.
    expect(pages()).toHaveLength(2)
    expect(within(page(0)).getAllByRole('listitem')).toHaveLength(15)

    rerender(
      <PrintSheet
        template="label"
        labels={makeCards(4)}
        labelSizeMm={70}
        columns={3}
        kitTitle="Küçük Çiftçiler"
      />,
    )

    expect(screen.getByText(/Etiketler A4 sayfaya sığmıyor/)).toBeInTheDocument()
  })

  it('prints kit box labels with the kit QR, the steps and every card code', () => {
    const cards = makeCards(3)
    renderWithProviders(
      <PrintSheet
        template="box"
        labels={[...cards, kitLabel]}
        kitTitle="Küçük Çiftçiler"
        backNote="Kutuyu kuru bir yerde saklayın."
      />,
    )

    expect(pages()).toHaveLength(1)
    // Four identical A6 labels per sheet; screen readers get one.
    expect(screen.getAllByRole('img', { name: 'KC QR kodu', hidden: true })).toHaveLength(4)
    const [box] = within(page(0)).getAllByRole('listitem')
    if (!box) throw new Error('Box label is missing')

    expect(within(box).getByText('Küçük Çiftçiler')).toBeInTheDocument()
    expect(within(box).getByRole('img', { name: 'KC QR kodu' })).toBeInTheDocument()
    expect(within(box).getByText('KC')).toBeInTheDocument()
    for (const step of ['Kâşif uygulamasını aç', "QR Okut'a dokun", 'Kartı okut']) {
      expect(within(box).getByText(step)).toBeInTheDocument()
    }
    for (const card of cards) {
      expect(within(box).getByText(card.code)).toBeInTheDocument()
      expect(within(box).getByText(card.title)).toBeInTheDocument()
    }
    expect(within(box).getByText('Kutuyu kuru bir yerde saklayın.')).toBeInTheDocument()
  })

  it('keeps the sheets in the light theme so they print dark on white', () => {
    renderWithProviders(<PrintSheet template="card" labels={makeCards(1)} kitTitle="Kit" />)

    expect(page(0)).toHaveAttribute('data-theme', 'light')
  })

  it('explains that there is nothing to print without labels', () => {
    renderWithProviders(<PrintSheet template="card" labels={[]} kitTitle="Kit" />)

    expect(screen.getByText('Yazdırılacak QR kodu yok')).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
