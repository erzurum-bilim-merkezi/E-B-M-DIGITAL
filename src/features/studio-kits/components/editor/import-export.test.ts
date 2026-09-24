import { BLOK_VITRINI, KUCUK_CIFTCILER, type KitDocument } from '@/entities/kit'

import { exportFileName, importKitJson } from './import-export'

/** An existing kit that already handed out codes up to KC-09. */
const TARGET: KitDocument = { ...KUCUK_CIFTCILER, qrSequence: 9 }

function imported(text: string) {
  const result = importKitJson(text, TARGET)
  if (!result.ok) throw new Error(`Import failed: ${result.message}`)
  return result.document
}

describe('importKitJson', () => {
  it('replaces the contents but keeps the kit identity', () => {
    const document = imported(JSON.stringify({ ...BLOK_VITRINI, version: 4 }))

    expect(document).toMatchObject({
      id: TARGET.id,
      slug: TARGET.slug,
      qrPrefix: 'KC',
      version: 0,
      title: BLOK_VITRINI.title,
    })
    expect(document.steps.map((step) => step.id)).toEqual(BLOK_VITRINI.steps.map((step) => step.id))
  })

  it('numbers new cards after the kit counter so no printed code is reused', () => {
    const document = imported(JSON.stringify(BLOK_VITRINI))

    expect(document.steps.slice(0, 3).map((step) => step.qrCode)).toEqual([
      'KC-10',
      'KC-11',
      'KC-12',
    ])
    expect(document.qrSequence).toBe(9 + BLOK_VITRINI.steps.length)
  })

  it('keeps the codes of cards the kit already has', () => {
    const document = imported(JSON.stringify(KUCUK_CIFTCILER))

    expect(document.steps.map((step) => step.qrCode)).toEqual(
      KUCUK_CIFTCILER.steps.map((step) => step.qrCode),
    )
    expect(document.qrSequence).toBe(9)
  })

  it.each([
    ['text that is not JSON', '{ bozuk', 'Dosya okunamadı: geçerli bir JSON değil.'],
    ['JSON that is not a kit', '{"title":"Liste"}', /Kâşif Kiti değil/],
    [
      'a kit from a newer app',
      JSON.stringify({ ...KUCUK_CIFTCILER, schemaVersion: 99 }),
      /şema 99/,
    ],
    ['a damaged kit', JSON.stringify({ ...KUCUK_CIFTCILER, steps: 'yok' }), /bozuk ya da eksik/],
  ])('rejects %s with a Turkish reason', (_, text, message) => {
    const result = importKitJson(text, TARGET)

    expect(result.ok).toBe(false)
    expect(result).toEqual({ ok: false, message: expect.stringMatching(message) })
  })
})

it('names exports after the kit address', () => {
  expect(exportFileName(KUCUK_CIFTCILER)).toBe('kucuk-ciftciler-kasif-kiti.json')
})
