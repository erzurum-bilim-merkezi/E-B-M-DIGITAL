import { isAppError } from '@/shared/api/errors'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { mediaRepository, type NewMedia } from '../index'

const png = (bytes = 64) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

const image = (overrides: Partial<NewMedia> = {}): NewMedia => ({
  blob: png(),
  kind: 'image',
  name: 'sera.png',
  alt: 'Serada marullar',
  mime: 'image/png',
  width: 800,
  height: 600,
  durationSec: null,
  ...overrides,
})

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!isAppError(error)) throw new Error(`expected an AppError, got ${String(error)}`)
  return error
}

describe('media repository (mock adapter)', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
    signInAs('editor')
  })

  it('stores an upload and lists it with a mock-media URL', async () => {
    const asset = await mediaRepository.upload(image())

    expect(asset.url).toBe(`mock-media:${asset.id}`)
    const listed = await mediaRepository.list({ kind: 'image', query: 'sera' })
    expect(listed.map((item) => item.id)).toContain(asset.id)
    expect(await mediaRepository.list({ kind: 'audio', query: '' })).not.toContainEqual(asset)
    expect(await mediaRepository.getMany([asset.id])).toHaveLength(1)
  })

  it('refuses videos, wrong types, oversized files and images without alt text', async () => {
    const video = await failure(
      mediaRepository.upload(
        image({ blob: new Blob(['x'], { type: 'video/mp4' }), mime: 'video/mp4' }),
      ),
    )
    expect(video.message).toMatch(/Video yüklenmez/)

    expect((await failure(mediaRepository.upload(image({ mime: 'image/svg+xml' })))).code).toBe(
      'validation',
    )
    expect((await failure(mediaRepository.upload(image({ blob: png(20_000_000) })))).code).toBe(
      'validation',
    )
    expect((await failure(mediaRepository.upload(image({ alt: '  ' })))).message).toMatch(
      /alternatif metin/,
    )
  })

  it('updates the alt text', async () => {
    const asset = await mediaRepository.upload(image())

    const updated = await mediaRepository.updateAlt(asset.id, 'Yeşil marullar')
    expect(updated.alt).toBe('Yeşil marullar')
    expect(
      (await failure(mediaRepository.updateAlt('00000000-0000-4000-8000-000000000000', 'x'))).code,
    ).toBe('not_found')
  })

  it('lets only admins delete files', async () => {
    const asset = await mediaRepository.upload(image())
    expect((await mediaRepository.usage(asset.id)).kits).toEqual([])
    expect((await failure(mediaRepository.remove(asset.id))).code).toBe('forbidden')

    signInAs('admin')
    await mediaRepository.remove(asset.id)
    expect(await mediaRepository.getMany([asset.id])).toEqual([])
  })

  it('reports storage against the Free-plan quota', async () => {
    await mediaRepository.upload(image({ blob: png(5_000) }))

    const quota = await mediaRepository.quota()
    expect(quota.storageBytes).toBeGreaterThanOrEqual(5_000)
    expect(quota.storageLimitBytes).toBeGreaterThan(quota.storageBytes)
    expect(quota.databaseLimitBytes).toBeGreaterThan(0)
  })

  it('is Studio-only', async () => {
    sessionStorage.clear()

    expect((await failure(mediaRepository.list({ kind: 'all', query: '' }))).code).toBe(
      'unauthorized',
    )
  })
})
