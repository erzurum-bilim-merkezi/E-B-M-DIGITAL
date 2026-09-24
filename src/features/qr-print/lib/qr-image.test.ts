import JSZip from 'jszip'

import {
  buildQrZip,
  layoutQrImage,
  qrFileName,
  qrZipFileName,
  renderQrSvg,
  wrapLines,
  type FontMeasure,
  type QrLabel,
} from './qr-image'

/** 10 px per character, counted in code points (a Turkish letter is one character). */
const measure = (text: string) => Array.from(text).length * 10
/** Proportional to the font size, like a real font. */
const fontMeasure: FontMeasure = (text, px) => Array.from(text).length * px * 0.6

const SITE = 'https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/'
const label: QrLabel = {
  code: 'KC-01',
  url: `${SITE}?q=KC-01`,
  title: 'Tohum nedir?',
  caption: 'Kart 1',
}

const parseSvg = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml')
/** Stands in for the canvas renderer (jsdom has no canvas): the PNG body is the code. */
const renderStub = async (item: QrLabel) => new Blob([item.code], { type: 'image/png' })

async function openZip(blob: Blob) {
  return JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()))
}

describe('qrFileName', () => {
  it('joins code and title into an ASCII slug', () => {
    expect(qrFileName('KC-01', 'Tohum nedir?')).toBe('kc-01-tohum-nedir')
    expect(qrFileName('KC-02', 'Işık ve Gölge: Çiçekler')).toBe('kc-02-isik-ve-golge-cicekler')
  })

  it('keeps names at most 60 characters without a trailing dash', () => {
    const name = qrFileName('KC-03', 'Çok uzun bir başlık '.repeat(10))

    expect(name.length).toBeLessThanOrEqual(60)
    expect(name).toMatch(/^kc-03-cok-uzun-bir-baslik/)
    expect(name).not.toMatch(/-$/)
  })

  it('falls back to a generic name when nothing printable is left', () => {
    expect(qrFileName('', '???')).toBe('qr')
  })
})

describe('qrZipFileName', () => {
  it('names the archive after the kit', () => {
    expect(qrZipFileName('kucuk-ciftciler')).toBe('kucuk-ciftciler-qr-kodlari.zip')
  })
})

describe('wrapLines', () => {
  it('keeps short text on one line', () => {
    expect(wrapLines('Tohum nedir?', 200, measure)).toEqual(['Tohum nedir?'])
  })

  it('wraps at word boundaries and measures Turkish letters as one character', () => {
    expect(wrapLines('Işık ve gölge nasıl oluşur?', 130, measure)).toEqual([
      'Işık ve gölge',
      'nasıl oluşur?',
    ])
  })

  it('ends the last allowed line with an ellipsis when the text does not fit', () => {
    const lines = wrapLines(
      'Bitkiler güneş ışığı olmadan nasıl büyür ve neden sararır?',
      130,
      measure,
    )

    expect(lines).toEqual(['Bitkiler', 'güneş ışığı…'])
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(130)
  })

  it('shortens a full last line to make room for the ellipsis', () => {
    expect(wrapLines('Fotosentez ışık tepkimeleri', 100, measure, 1)).toEqual(['Fotosente…'])
  })

  it('breaks words that are longer than a line', () => {
    expect(wrapLines('Fotosentezleştiremediklerimizden', 100, measure, 5)).toEqual([
      'Fotosentez',
      'leştiremed',
      'iklerimizd',
      'en',
    ])
  })

  it('returns no lines for blank text', () => {
    expect(wrapLines('   ', 100, measure)).toEqual([])
  })
})

describe('layoutQrImage', () => {
  it('keeps a 4-module quiet zone around the QR inside the 1024 px image', () => {
    const layout = layoutQrImage(label, 33, fontMeasure)
    const { x, cell } = layout.qr

    expect(layout.width).toBe(1024)
    expect(x).toBeGreaterThanOrEqual(4 * cell)
    expect(x + 33 * cell + 4 * cell).toBeLessThanOrEqual(1024)
  })

  it('shrinks a long title to fit two lines before truncating it', () => {
    const short = layoutQrImage(label, 33, fontMeasure)
    const long = layoutQrImage(
      { ...label, title: 'Tohumlar toprağın altında su ve sıcaklıkla nasıl filizlenir ve büyür?' },
      33,
      fontMeasure,
    )

    expect(short.title).toMatchObject({ px: 58, lines: ['Tohum nedir?'] })
    expect(long.title.px).toBeLessThan(58)
    expect(long.title.lines).toHaveLength(2)
    expect(long.height).toBeGreaterThan(short.height)
  })

  it('prefers a smaller font over breaking a long word', () => {
    // 32 letters: too wide for 880 px at 58 px (0.6 em each), fits at 42 px.
    const layout = layoutQrImage(
      { ...label, title: 'Fotosentezleştiremediklerimizden misiniz?' },
      33,
      fontMeasure,
    )

    expect(layout.title).toEqual({
      px: 42,
      lines: ['Fotosentezleştiremediklerimizden', 'misiniz?'],
      baselines: expect.any(Array),
    })
  })

  it('truncates a title that does not fit two lines even at the smallest size', () => {
    const layout = layoutQrImage(
      { ...label, title: 'Çok uzun başlık '.repeat(12) },
      33,
      fontMeasure,
    )

    expect(layout.title.px).toBe(34)
    expect(layout.title.lines).toHaveLength(2)
    expect(layout.title.lines[1]).toMatch(/…$/)
  })
})

describe('renderQrSvg', () => {
  it('produces a well-formed SVG document with escaped text', () => {
    const svg = renderQrSvg({ ...label, title: 'Su & "buz" <deney>' })
    const document = parseSvg(svg)

    expect(document.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(document.documentElement.getAttribute('viewBox')).toMatch(/^0 0 1024 \d+$/)
    expect(Array.from(document.getElementsByTagName('text'), (node) => node.textContent)).toEqual([
      'Kart 1',
      'Su & "buz" <deney>',
      'KC-01',
      'Kâşif ile okut',
    ])
    expect(svg).toContain('Su &amp; &quot;buz&quot; &lt;deney&gt;')
  })

  it('drops characters that XML does not allow', () => {
    const svg = renderQrSvg({ ...label, title: `Tohum${String.fromCharCode(7)} nedir?` })

    expect(parseSvg(svg).getElementsByTagName('parsererror')).toHaveLength(0)
    expect(svg).toContain('Tohum nedir?')
  })
})

describe('buildQrZip', () => {
  const labels: QrLabel[] = [
    { code: 'KC', url: `${SITE}?q=KC`, title: 'Küçük Çiftçiler', caption: 'Kit kodu' },
    label,
    { code: 'KC-02', url: `${SITE}?q=KC-02`, title: 'Işık', caption: 'Kart 2' },
  ]

  it('stores one PNG per label in a kit folder and reports progress', async () => {
    const onProgress = vi.fn<(done: number, total: number) => void>()

    const zip = await openZip(await buildQrZip(labels, 'kucuk-ciftciler', onProgress, renderStub))

    expect(Object.keys(zip.files).filter((name) => name.endsWith('.png'))).toEqual([
      'kucuk-ciftciler-qr-kodlari/kc-kucuk-ciftciler.png',
      'kucuk-ciftciler-qr-kodlari/kc-01-tohum-nedir.png',
      'kucuk-ciftciler-qr-kodlari/kc-02-isik.png',
    ])
    expect(
      await zip.file('kucuk-ciftciler-qr-kodlari/kc-01-tohum-nedir.png')?.async('string'),
    ).toBe('KC-01')
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('never overwrites a file when two labels get the same name', async () => {
    const zip = await openZip(await buildQrZip([label, label], 'kit', undefined, renderStub))

    expect(Object.keys(zip.files).filter((name) => name.endsWith('.png'))).toEqual([
      'kit-qr-kodlari/kc-01-tohum-nedir.png',
      'kit-qr-kodlari/kc-01-tohum-nedir-2.png',
    ])
  })
})
