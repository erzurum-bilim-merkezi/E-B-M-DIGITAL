import { http, HttpResponse } from 'msw'

import { KUCUK_CIFTCILER, type KitDocument, type StudioKit } from '@/entities/kit'
import { isAppError } from '@/shared/api/errors'
import { server } from '@/test/mocks/server'
import { resetSupabase, rpc, rpcError, signedInStaff, SUPABASE_URL, table } from '@/test/supabase'

import {
  createSupabaseKitRepository,
  createSupabasePublishingService,
  createSupabaseQrRegistry,
} from './studio-kits.supabase'

const kits = createSupabaseKitRepository()
const publishing = createSupabasePublishingService()
const qr = createSupabaseQrRegistry()

const KIT_ID = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
const USER_ID = '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'
const NOW = '2026-09-25T10:00:00+00:00'

function draft(): KitDocument {
  return { ...structuredClone(KUCUK_CIFTCILER), id: KIT_ID, version: 0 }
}

function kitRow(overrides: Partial<StudioKit> = {}): StudioKit {
  return {
    id: KIT_ID,
    slug: KUCUK_CIFTCILER.slug,
    qrPrefix: KUCUK_CIFTCILER.qrPrefix,
    status: 'draft',
    visibility: 'public',
    draft: draft(),
    publishedVersion: null,
    firstPublishedAt: null,
    lastPublishedAt: null,
    reviewNote: null,
    reviewedLockVersion: null,
    lockVersion: 4,
    publishedLockVersion: null,
    ownerId: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: USER_ID,
    ...overrides,
  }
}

function version(number: number, finalized: boolean) {
  return {
    kitId: KIT_ID,
    version: number,
    document: { ...draft(), version: number },
    notes: '',
    publishedBy: USER_ID,
    publishedAt: NOW,
    aiReviewConfirmed: false,
    finalizedAt: finalized ? NOW : null,
    sourceLockVersion: 4,
  }
}

type Upload = { path: string; upsert: string | null; cacheControl: string | null }

/** Storage uploads to the published bucket. */
function publishedBucket() {
  const uploads: Upload[] = []
  const prefix = `${SUPABASE_URL}/storage/v1/object/published/`
  server.use(
    http.post(
      new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`),
      async ({ request }) => {
        const path = decodeURIComponent(
          new URL(request.url).pathname.split('/object/published/')[1] ?? '',
        )
        const form = await request.formData().catch(() => null)
        const cacheControl = form?.get('cacheControl')
        uploads.push({
          path,
          upsert: request.headers.get('x-upsert'),
          cacheControl:
            typeof cacheControl === 'string' ? cacheControl : request.headers.get('cache-control'),
        })
        return HttpResponse.json({ Key: `published/${path}` })
      },
    ),
  )
  return uploads
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

beforeEach(() => signedInStaff(USER_ID))
afterEach(resetSupabase)

describe('Supabase kit repository', () => {
  it('saves a draft through the RPC and hands back the latest kit on a conflict', async () => {
    const calls = rpc('kit_save_draft', () => kitRow({ lockVersion: 5 }))
    await kits.update(KIT_ID, draft(), 4)
    expect(calls[0]).toMatchObject({ p_kit: KIT_ID, p_lock_version: 4 })

    rpcError('kit_save_draft', 'KS409', 'Bu kit başka bir yerde değiştirildi.', {
      latest: kitRow({ lockVersion: 7 }),
    })
    const error = await failure(kits.update(KIT_ID, draft(), 4))
    expect(isAppError(error, 'conflict') && error.details['latest']).toMatchObject({
      lockVersion: 7,
    })
  })

  it('refuses a structurally broken draft before any request', async () => {
    const error = await failure(kits.update(KIT_ID, { ...draft(), steps: 'x' } as never, 4))
    expect(isAppError(error, 'validation')).toBe(true)
  })

  it('filters, searches and pages the kit list on the server', async () => {
    const queries: URLSearchParams[] = []
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/kits`, ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json([kitRow()], { headers: { 'Content-Range': '10-19/25' } })
      }),
    )
    const page = await kits.list({ status: 'draft', query: 'çift', page: 2, pageSize: 10 })

    expect(page).toMatchObject({ total: 25, page: 2, pageCount: 3 })
    const query = queries[0]
    expect(query?.get('status')).toBe('eq.draft')
    expect(query?.get('or')).toBe(
      '(draft->>title.ilike.*çift*,slug.ilike.*çift*,qr_prefix.eq.ÇIFT)',
    )
    expect(query?.get('order')).toBe('updated_at.desc,id.asc')
  })

  it('goes to the last page when the asked one no longer exists', async () => {
    const offsets: (string | null)[] = []
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/kits`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get('offset')
        offsets.push(offset)
        return Number(offset ?? 0) >= 12
          ? HttpResponse.json(
              { code: 'PGRST103', message: 'Requested range not satisfiable', details: null },
              { status: 416, headers: { 'Content-Range': '*/12' } },
            )
          : HttpResponse.json([kitRow()], {
              headers: { 'Content-Range': `${offset ?? 0}-${Number(offset ?? 0)}/12` },
            })
      }),
    )
    const page = await kits.list({ status: 'all', query: '', page: 3, pageSize: 10 })

    expect(page).toMatchObject({ total: 12, page: 2, pageCount: 2 })
    expect(offsets).toEqual(['20', '0', '10'])
  })

  it('duplicates a kit with a free address and prefix', async () => {
    table('kits', [kitRow()])
    rpc('kit_taken_prefixes', () => ['KC'])
    const calls = rpc('kit_create', (args) =>
      kitRow({ id: String(args['p_id']), slug: String(args['p_slug']) }),
    )
    await kits.duplicate(KIT_ID)
    expect(calls[0]).toMatchObject({
      p_slug: 'kucuk-ciftciler-kopya',
      p_qr_prefix: 'KCA',
      p_duplicate_of: KIT_ID,
    })
  })
})

describe('Supabase publishing saga', () => {
  it('reserves a version, writes the immutable snapshot, finalizes and rebuilds the indexes', async () => {
    const steps: string[] = []
    rpc('publish_acquire_lease', () => {
      steps.push('lease')
      return true
    })
    table('kits', [kitRow()])
    rpc('publish_reserve_version', (args) => {
      steps.push('reserve')
      expect(args['p_lock_version']).toBe(4)
      return version(1, false)
    })
    rpc('publish_finalize', () => {
      steps.push('finalize')
      return {
        kit: kitRow({ status: 'published', publishedVersion: 1 }),
        version: version(1, true),
      }
    })
    rpc('publish_generation', () => 7)
    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/kit_versions`, () => HttpResponse.json([version(1, true)])),
      http.get(`${SUPABASE_URL}/rest/v1/qr_codes`, () =>
        HttpResponse.json([
          { code: 'KC', kitId: KIT_ID, stepId: null, active: true, createdAt: NOW },
        ]),
      ),
    )
    rpc('publish_release_lease', () => {
      steps.push('release')
      return null
    })
    const uploads = publishedBucket()

    const result = await publishing.publish(KIT_ID, {
      notes: 'ilk',
      visibility: 'public',
      lockVersion: 4,
      aiReviewConfirmed: false,
    })

    expect(result.version.version).toBe(1)
    expect(steps).toEqual(['lease', 'reserve', 'finalize', 'release'])
    const byPath = new Map(uploads.map((upload) => [upload.path, upload]))
    expect(byPath.get('kits/kucuk-ciftciler/v1.json')).toMatchObject({
      upsert: 'false',
      cacheControl: 'max-age=31536000',
    })
    expect(byPath.get('catalog.json')).toMatchObject({ upsert: 'true', cacheControl: 'max-age=0' })
    expect(byPath.has('qr-index.json')).toBe(true)
    expect(byPath.has('kits/kucuk-ciftciler/latest.json')).toBe(true)
  })

  it('reports a refused snapshot write instead of comparing contents', async () => {
    rpc('publish_acquire_lease', () => true)
    const released = rpc('publish_release_lease', () => null)
    table('kits', [kitRow()])
    rpc('publish_reserve_version', () => version(1, false))
    const finalize = rpc('publish_finalize', () => null)
    server.use(
      http.post(/\/storage\/v1\/object\/published\//, () =>
        HttpResponse.json(
          { statusCode: '403', error: 'Unauthorized', message: 'row-level security' },
          { status: 400 },
        ),
      ),
    )

    const error = await failure(
      publishing.publish(KIT_ID, {
        notes: '',
        visibility: 'public',
        lockVersion: 4,
        aiReviewConfirmed: false,
      }),
    )

    // No download of the existing file (MSW fails unhandled requests), no finalize.
    expect(isAppError(error, 'unavailable')).toBe(true)
    expect(finalize).toEqual([])
    expect(released).toHaveLength(1)
  })

  it.each([
    ['an identical file from an interrupted run counts as written', 'same', null],
    ['a file with other content is a conflict', 'other', 'conflict'],
    ['a file that cannot be read back is a retryable failure', 'unreadable', 'unavailable'],
  ] as const)('publishing over an existing snapshot: %s', async (_, existing, code) => {
    rpc('publish_acquire_lease', () => true)
    rpc('publish_release_lease', () => null)
    table('kits', [kitRow()])
    rpc('publish_reserve_version', () => version(1, false))
    // Answers with nothing a finished publish needs: reaching it is what this test checks.
    const finalize = rpc('publish_finalize', () => null)
    const path = `${SUPABASE_URL}/storage/v1/object/published/kits/kucuk-ciftciler/v1.json`
    server.use(
      http.post(path, () =>
        HttpResponse.json(
          { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' },
          { status: 400 },
        ),
      ),
      http.get(path, () =>
        existing === 'unreadable'
          ? HttpResponse.json({ statusCode: '500', message: 'boom' }, { status: 500 })
          : HttpResponse.json(existing === 'same' ? version(1, false).document : { other: true }),
      ),
    )

    const error = await failure(
      publishing.publish(KIT_ID, {
        notes: '',
        visibility: 'public',
        lockVersion: 4,
        aiReviewConfirmed: false,
      }),
    )

    expect(finalize).toHaveLength(code ? 0 : 1)
    expect(code === null || isAppError(error, code)).toBe(true)
  })

  it('waits for another publish instead of racing it', async () => {
    rpc('publish_acquire_lease', () => false)
    const error = await failure(
      publishing.publish(KIT_ID, {
        notes: '',
        visibility: 'public',
        lockVersion: 4,
        aiReviewConfirmed: false,
      }),
    )
    expect(isAppError(error, 'conflict') && error.message).toMatch(/Başka bir yayın sürüyor/)
  })

  it('stops at validation problems before reserving anything', async () => {
    rpc('publish_acquire_lease', () => true)
    rpc('publish_release_lease', () => null)
    table('kits', [kitRow({ draft: { ...draft(), steps: [] } })])
    const reserve = rpc('publish_reserve_version', () => version(1, false))

    const error = await failure(
      publishing.publish(KIT_ID, {
        notes: '',
        visibility: 'public',
        lockVersion: 4,
        aiReviewConfirmed: false,
      }),
    )

    expect(isAppError(error, 'validation')).toBe(true)
    expect(reserve).toEqual([])
  })

  it('refuses a stale lock version with the latest kit', async () => {
    rpc('publish_acquire_lease', () => true)
    rpc('publish_release_lease', () => null)
    table('kits', [kitRow({ lockVersion: 9 })])
    const error = await failure(
      publishing.publish(KIT_ID, {
        notes: '',
        visibility: 'public',
        lockVersion: 4,
        aiReviewConfirmed: false,
      }),
    )
    expect(isAppError(error, 'conflict') && error.details['latest']).toMatchObject({
      lockVersion: 9,
    })
  })
})

/** The rebuild after an archive or unarchive: storage writes and removals. */
function publishedIndexes(kit: StudioKit) {
  rpc('publish_acquire_lease', () => true)
  rpc('publish_release_lease', () => null)
  rpc('publish_generation', () => 7)
  table('kits', [kit])
  table('kit_versions', [version(1, true)])
  table('qr_codes', [])
  const removed: unknown[] = []
  server.use(
    http.delete(`${SUPABASE_URL}/storage/v1/object/published`, async ({ request }) => {
      removed.push(await request.json())
      return HttpResponse.json([])
    }),
  )
  return { uploads: publishedBucket(), removed }
}

describe('Supabase index regeneration', () => {
  it('takes an archived kit off its address', async () => {
    const archived = kitRow({ status: 'archived', publishedVersion: 1 })
    rpc('kit_archive', () => archived)
    const { uploads, removed } = publishedIndexes(archived)

    await publishing.archive(KIT_ID)

    expect(removed).toEqual([{ prefixes: ['kits/kucuk-ciftciler/latest.json'] }])
    expect(uploads.map((upload) => upload.path).toSorted()).toEqual([
      'catalog.json',
      'qr-index.json',
    ])
  })

  it('points a restored kit to its latest version again', async () => {
    const back = kitRow({ status: 'published', publishedVersion: 1 })
    rpc('kit_unarchive', () => back)
    const { uploads, removed } = publishedIndexes(back)

    await publishing.unarchive(KIT_ID)

    expect(removed).toEqual([])
    expect(uploads.map((upload) => upload.path)).toContain('kits/kucuk-ciftciler/latest.json')
  })
})

describe('Supabase QR registry', () => {
  it('marks published codes live and the others pending', async () => {
    const published = version(1, true)
    published.document.steps = published.document.steps.slice(0, 2)
    table('kits', [kitRow({ status: 'published', publishedVersion: 1 })])
    table('kit_versions', [published])
    table('qr_codes', [])

    const codes = await qr.listForKit(KIT_ID)

    expect(codes[0]).toMatchObject({ code: 'KC', state: 'live' })
    expect(codes.slice(1, 3).every((code) => code.state === 'live')).toBe(true)
    expect(codes[3]?.state).toBe('pending')
  })
})
