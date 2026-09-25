import { http, HttpResponse } from 'msw'

import { isAppError } from '@/shared/api/errors'
import { server } from '@/test/mocks/server'
import { resetSupabase, rpc, rpcError, signedInStaff, SUPABASE_URL, table } from '@/test/supabase'

import { createSupabaseMediaRepository } from './media.supabase'

const media = createSupabaseMediaRepository()

const USER_ID = '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'image',
    name: 'tohum.webp',
    mime: 'image/webp',
    bytes: 1000,
    width: 800,
    height: 600,
    durationSec: null,
    alt: 'Toprakta bir tohum',
    path: `uploads/${id}.webp`,
    source: 'upload',
    sceneGroup: null,
    sceneState: null,
    createdBy: USER_ID,
    createdAt: '2026-09-25T10:00:00+00:00',
    ...overrides,
  }
}

/** Storage calls on a bucket (uploads and removals). */
function storageBucket(bucket: 'media' | 'ai' = 'media') {
  const log: string[] = []
  server.use(
    http.post(new RegExp(`/storage/v1/object/${bucket}/`), ({ request }) => {
      log.push(
        `upload ${new URL(request.url).pathname.split(`/object/${bucket}/`)[1] ?? ''} ${request.headers.get('content-type') ?? ''}`,
      )
      return HttpResponse.json({ Key: `${bucket}/x`, Id: 'x' })
    }),
    http.delete(`${SUPABASE_URL}/storage/v1/object/${bucket}`, async ({ request }) => {
      log.push(`remove ${JSON.stringify(await request.json())}`)
      return HttpResponse.json([])
    }),
  )
  return log
}

function file(type: string, size = 1000) {
  return new Blob([new Uint8Array(size)], { type })
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

beforeEach(() => signedInStaff(USER_ID))
afterEach(resetSupabase)

describe('Supabase media repository', () => {
  it('uploads to uploads/<id>.<ext> and registers the file', async () => {
    const log = storageBucket()
    const calls = rpc('media_register', (args) => row(String(args['p_id'])))

    const asset = await media.upload({
      blob: file('image/webp'),
      kind: 'image',
      name: 'tohum.webp',
      alt: 'Toprakta bir tohum',
      mime: 'image/webp',
      width: 800,
      height: 600,
      durationSec: null,
    })

    const id = String(calls[0]?.['p_id'])
    expect(log).toEqual([`upload uploads/${id}.webp image/webp`])
    expect(asset.url).toBe(`${SUPABASE_URL}/storage/v1/object/public/media/uploads/${id}.webp`)
  })

  it('removes the uploaded file again when the server refuses it', async () => {
    const log = storageBucket()
    rpcError('media_register', 'KS422', 'Dosya boyut sınırını aşıyor.')
    const error = await failure(
      media.upload({
        blob: file('image/png'),
        kind: 'image',
        name: 'a.png',
        alt: 'görsel',
        mime: 'image/png',
        width: null,
        height: null,
        durationSec: null,
      }),
    )
    expect(isAppError(error, 'validation')).toBe(true)
    expect(log.at(-1)).toMatch(/^remove .*uploads\/.*\.png/)
  })

  it.each([
    ['a video', { blob: file('video/mp4'), kind: 'audio', mime: 'video/mp4', alt: '' }],
    [
      'a disguised file',
      { blob: file('image/svg+xml'), kind: 'image', mime: 'image/png', alt: 'x' },
    ],
    [
      'an image over 300 kB',
      { blob: file('image/webp', 400_000), kind: 'image', mime: 'image/webp', alt: 'x' },
    ],
    [
      'an image without alt text',
      { blob: file('image/webp'), kind: 'image', mime: 'image/webp', alt: ' ' },
    ],
  ] as const)('refuses %s before any request', async (_, input) => {
    const error = await failure(
      media.upload({ ...input, name: 'dosya', width: null, height: null, durationSec: null }),
    )
    expect(isAppError(error, 'validation')).toBe(true)
  })

  it('lists and searches assets with public URLs', async () => {
    const id = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
    const queries = table('media_assets', [row(id)])
    const [asset] = await media.list({ kind: 'image', query: 'tohum' })
    expect(asset?.url).toContain(`/public/media/uploads/${id}.webp`)
    expect(queries[0]?.get('kind')).toBe('eq.image')
    expect(queries[0]?.get('or')).toBe('(name.ilike.*tohum*,alt.ilike.*tohum*)')
    // Paged past the server's row cap in a stable order: newest first, id breaks ties.
    expect(queries[0]?.get('order')).toBe('created_at.desc,id.asc')
    expect(queries[0]?.get('limit')).toBe('1000')
  })

  it('links AI drawings from the ai bucket', async () => {
    const id = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
    table('media_assets', [
      row(id, { kind: 'ai-icon', mime: 'image/svg+xml', path: `icons/${id}.svg`, source: 'ai' }),
    ])
    const [asset] = await media.list({ kind: 'all', query: '' })
    expect(asset?.url).toBe(`${SUPABASE_URL}/storage/v1/object/public/ai/icons/${id}.svg`)
  })

  it('deletes the record, then the file', async () => {
    const id = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
    const log = storageBucket()
    rpc('media_delete', () => ({ bucket: 'media', path: `uploads/${id}.webp` }))
    await media.remove(id)
    expect(log).toEqual([`remove {"prefixes":["uploads/${id}.webp"]}`])
  })

  it('deletes an AI drawing from the bucket the database names', async () => {
    const id = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
    const uploads = storageBucket('media')
    const drawings = storageBucket('ai')
    rpc('media_delete', () => ({ bucket: 'ai', path: `icons/${id}.svg` }))
    await media.remove(id)
    expect(drawings).toEqual([`remove {"prefixes":["icons/${id}.svg"]}`])
    expect(uploads).toEqual([])
  })
})
