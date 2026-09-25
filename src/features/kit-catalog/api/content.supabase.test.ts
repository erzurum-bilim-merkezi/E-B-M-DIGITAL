import { BLOK_VITRINI } from '@/entities/kit'
import { isAppError } from '@/shared/api/errors'
import { publicFile } from '@/test/supabase'

import { createSupabaseContentSource } from './content.supabase'

const source = createSupabaseContentSource()

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('Supabase content source (published bucket)', () => {
  it('reads the catalog and QR index, or empty ones before the first publish', async () => {
    publicFile('published', 'catalog.json', null, 400)
    publicFile('published', 'qr-index.json', null, 400)

    expect(await source.catalog()).toMatchObject({ generation: 0, kits: [] })
    expect(await source.qrIndex()).toMatchObject({ codes: {} })
  })

  it('follows latest.json to the immutable version file', async () => {
    publicFile('published', 'kits/blok-vitrini/latest.json', {
      version: 3,
      publishedAt: '2026-09-25T10:00:00.000Z',
    })
    publicFile('published', 'kits/blok-vitrini/v3.json', { ...BLOK_VITRINI, version: 3 })

    const kit = await source.kit('blok-vitrini')
    expect(kit).toMatchObject({ slug: 'blok-vitrini', version: 3 })
  })

  it('answers not_found for an unpublished kit', async () => {
    publicFile('published', 'kits/yok/latest.json', null, 400)
    expect(isAppError(await failure(source.kit('yok')), 'not_found')).toBe(true)
  })

  it('refuses a kit made for a newer app with an explanation', async () => {
    publicFile('published', 'kits/yeni/v1.json', { ...BLOK_VITRINI, schemaVersion: 99 })
    const error = await failure(source.kitVersion('yeni', 1))
    expect(isAppError(error, 'unavailable') && error.message).toMatch(/Uygulamayı güncelleyin/)
  })

  it('reports a malformed catalog as unavailable, not as a crash', async () => {
    publicFile('published', 'catalog.json', { kits: 'bozuk' })
    expect(isAppError(await failure(source.catalog()), 'unavailable')).toBe(true)
  })
})
