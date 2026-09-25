import { downloadBlob } from '@/shared/lib/download'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import { renderQrPng } from '../lib/qr-image'
import { QrPreviewGrid, type QrPreviewItem } from './QrPreviewGrid'

vi.mock(import('@/shared/lib/download'), async (importOriginal) => ({
  ...(await importOriginal()),
  downloadBlob: vi.fn<typeof downloadBlob>(),
}))
// jsdom has no canvas: PNG rendering is stubbed, SVG rendering runs for real.
vi.mock(import('../lib/qr-image'), async (importOriginal) => ({
  ...(await importOriginal()),
  renderQrPng: vi.fn<typeof renderQrPng>(),
}))

/** A promise the test settles when it wants to. */
function deferred<T>() {
  const handle: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    handle.resolve = resolve
  })
  return { promise, resolve: (value: T) => handle.resolve?.(value) }
}

const SITE = 'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/'
const items: QrPreviewItem[] = [
  {
    code: 'KC',
    url: `${SITE}?q=KC`,
    title: 'Küçük Çiftçiler',
    caption: 'Kit kodu',
    state: 'live',
    icon: '🌾',
  },
  {
    code: 'KC-01',
    url: `${SITE}?q=KC-01`,
    title: 'Tohum nedir?',
    caption: 'Kart 1',
    state: 'pending',
  },
  {
    code: 'KC-02',
    url: `${SITE}?q=KC-02`,
    title: 'Eski kart',
    caption: 'Kart 2',
    state: 'retired',
  },
]

const cards = () =>
  within(screen.getByRole('list', { name: 'QR kodları' })).getAllByRole('listitem')
const card = (index: number) => {
  const found = cards()[index]
  if (!found) throw new Error(`Card ${index + 1} is missing`)
  return found
}

beforeEach(() => {
  vi.mocked(downloadBlob).mockReset()
  vi.mocked(renderQrPng).mockReset()
})

describe('QrPreviewGrid', () => {
  it('shows each code with its caption, title, state and QR', () => {
    renderWithProviders(<QrPreviewGrid labels={items} />)

    expect(cards()).toHaveLength(3)
    expect(within(card(0)).getByText('Kit kodu')).toBeInTheDocument()
    expect(within(card(0)).getByText('Küçük Çiftçiler')).toBeInTheDocument()
    expect(within(card(0)).getByText('Yayında')).toBeInTheDocument()
    expect(within(card(1)).getByText('Yayın bekliyor')).toBeInTheDocument()
    expect(within(card(2)).getByText('Kullanım dışı')).toBeInTheDocument()
    expect(within(card(1)).getByRole('img', { name: 'KC-01 QR kodu' })).toBeInTheDocument()
    expect(within(card(1)).getByText('KC-01')).toBeInTheDocument()
    expect(within(card(1)).getByText('Tohum nedir?')).toBeInTheDocument()
  })

  it('downloads an SVG named after the code and title', async () => {
    const { user } = renderWithProviders(<QrPreviewGrid labels={items} />)

    await user.click(screen.getByRole('button', { name: 'KC-01 SVG indir' }))

    expect(downloadBlob).toHaveBeenCalledOnce()
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0] ?? []
    expect(fileName).toBe('kc-01-tohum-nedir.svg')
    expect(blob?.type).toBe('image/svg+xml')
    expect(await blob?.text()).toContain('Tohum nedir?')
    expect(await screen.findByText('KC-01 SVG dosyası indirildi.')).toBeInTheDocument()
  })

  it('marks the card busy while the PNG renders, then downloads it', async () => {
    const png = deferred<Blob>()
    vi.mocked(renderQrPng).mockReturnValue(png.promise)
    const { user } = renderWithProviders(<QrPreviewGrid labels={items} />)
    const pngButton = screen.getByRole('button', { name: 'KC-01 PNG indir' })

    await user.click(pngButton)

    expect(pngButton).toHaveAttribute('aria-busy', 'true')
    expect(card(1)).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'KC-01 SVG indir' })).toBeDisabled()

    png.resolve(new Blob(['png'], { type: 'image/png' }))

    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'kc-01-tohum-nedir.png'),
    )
    expect(pngButton).not.toHaveAttribute('aria-busy')
    expect(card(1)).not.toHaveAttribute('aria-busy')
  })

  it('explains a failed PNG and succeeds when tried again', async () => {
    vi.mocked(renderQrPng)
      .mockRejectedValueOnce(new Error('canvas unavailable'))
      .mockResolvedValueOnce(new Blob(['png'], { type: 'image/png' }))
    const { user } = renderWithProviders(<QrPreviewGrid labels={items} />)

    await user.click(screen.getByRole('button', { name: 'KC PNG indir' }))

    expect(await within(card(0)).findByRole('alert')).toHaveTextContent(
      'PNG dosyası oluşturulamadı. Tekrar deneyin.',
    )
    expect(downloadBlob).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'KC PNG indir' }))

    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'kc-kucuk-ciftciler.png'),
    )
    expect(within(card(0)).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no codes', () => {
    renderWithProviders(<QrPreviewGrid labels={[]} />)

    expect(screen.getByText('Gösterilecek QR kodu yok')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
