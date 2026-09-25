import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'
import { mockControl } from '@/shared/api/mock-db'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { act, createTestQueryClient, renderHook, waitFor } from '@/test/test-utils'

import {
  allKitsQueryOptions,
  kitListQueryOptions,
  kitQrQueryOptions,
  kitQueryOptions,
  kitRepository,
  kitVersionsQueryOptions,
  publishingService,
  studioKitKeys,
  useDeleteKit,
  usePublishKit,
  useRegenerateSnapshots,
  useRestoreVersion,
  type KitListFilter,
} from '../index'

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderQueryHook<T>(hook: () => T, queryClient = createTestQueryClient()) {
  return { ...renderHook(hook, { wrapper: wrapperFor(queryClient) }), queryClient }
}

async function kitBySlug(slug: string) {
  const kit = (await kitRepository.listAll()).find((candidate) => candidate.slug === slug)
  if (!kit) throw new Error(`No kit ${slug}`)
  return kit
}

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('admin')
})

it('builds every Studio kit key under the shared Studio root', () => {
  const filter: KitListFilter = { status: 'all', query: '', page: 1, pageSize: 10 }

  expect(studioKitKeys.list(filter)).toEqual([STUDIO_QUERY_ROOT, 'kits', 'list', filter])
  expect(studioKitKeys.everything()).toEqual([STUDIO_QUERY_ROOT, 'kits', 'all'])
  expect(studioKitKeys.detail('k')).toEqual([STUDIO_QUERY_ROOT, 'kits', 'detail', 'k'])
  expect(studioKitKeys.versions('k')).toEqual([STUDIO_QUERY_ROOT, 'kits', 'versions', 'k'])
  expect(studioKitKeys.qr('k')).toEqual([STUDIO_QUERY_ROOT, 'kits', 'qr', 'k'])
})

describe('query options', () => {
  it('keeps showing the current page while the next one loads', async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useQuery(kitListQueryOptions({ status: 'all', query: '', page, pageSize: 1 })),
      { wrapper: wrapperFor(createTestQueryClient()), initialProps: { page: 1 } },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const first = result.current.data
    mockControl.hold('kits.list')

    rerender({ page: 2 })

    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.data).toBe(first)
    mockControl.release('kits.list')
    await waitFor(() => expect(result.current.data?.page).toBe(2))
    expect(result.current.data?.items[0]?.id).not.toBe(first?.items[0]?.id)
  })

  it('loads a kit, its published versions and its QR codes', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')

    const { result } = renderQueryHook(() => ({
      kit: useQuery(kitQueryOptions(kit.id)),
      versions: useQuery(kitVersionsQueryOptions(kit.id)),
      qr: useQuery(kitQrQueryOptions(kit.id)),
      all: useQuery(allKitsQueryOptions()),
    }))

    await waitFor(() => expect(result.current.qr.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.versions.isSuccess).toBe(true))
    expect(result.current.kit.data?.id).toBe(kit.id)
    expect(result.current.versions.data?.map((version) => version.version)).toEqual([1])
    expect(result.current.qr.data?.map((code) => code.state)).toEqual(
      Array.from({ length: kit.draft.steps.length + 1 }, () => 'live'),
    )
    await waitFor(() => expect(result.current.all.data).toHaveLength(2))
  })

  it('reports a failed load', async () => {
    const unknownId = crypto.randomUUID()

    const { result } = renderQueryHook(() => useQuery(kitQueryOptions(unknownId)))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ code: 'not_found' })
  })
})

describe('mutations', () => {
  it('puts the published kit into the cache and refreshes the other Studio views', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')
    const edited = await kitRepository.update(kit.id, kit.draft, kit.lockVersion)
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(studioKitKeys.detail(kit.id), edited)
    queryClient.setQueryData(studioKitKeys.everything(), [])
    const { result } = renderQueryHook(() => usePublishKit(), queryClient)

    await act(() =>
      result.current.mutateAsync({
        id: kit.id,
        input: { notes: '', visibility: 'public', lockVersion: 1, aiReviewConfirmed: false },
      }),
    )

    expect(queryClient.getQueryData(studioKitKeys.detail(kit.id))).toMatchObject({
      publishedVersion: 2,
      status: 'published',
    })
    expect(isInvalidated(queryClient, studioKitKeys.detail(kit.id))).toBe(false)
    expect(isInvalidated(queryClient, studioKitKeys.everything())).toBe(true)
  })

  it('restores an old version as the working copy', async () => {
    const kit = await kitBySlug('kucuk-ciftciler')
    const edited = await kitRepository.update(
      kit.id,
      { ...kit.draft, title: 'Değişti' },
      kit.lockVersion,
    )
    const { result, queryClient } = renderQueryHook(() => useRestoreVersion())

    await act(() =>
      result.current.mutateAsync({ id: kit.id, version: 1, lockVersion: edited.lockVersion }),
    )

    expect(queryClient.getQueryData(studioKitKeys.detail(kit.id))).toMatchObject({
      draft: { title: 'Küçük Çiftçiler' },
      lockVersion: edited.lockVersion + 1,
    })
  })

  it('forgets a deleted kit', async () => {
    const draft = await kitRepository.duplicate((await kitBySlug('blok-vitrini')).id)
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(studioKitKeys.detail(draft.id), draft)
    queryClient.setQueryData(studioKitKeys.everything(), [draft])
    const { result } = renderQueryHook(() => useDeleteKit(), queryClient)

    await act(() => result.current.mutateAsync(draft.id))

    expect(queryClient.getQueryData(studioKitKeys.detail(draft.id))).toBeUndefined()
    expect(isInvalidated(queryClient, studioKitKeys.everything())).toBe(true)
  })

  it('refreshes everything after regenerating the published files', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['kasif', 'catalog'], { kits: [] })
    const { result } = renderQueryHook(() => useRegenerateSnapshots(), queryClient)

    await act(() => result.current.mutateAsync())

    expect(isInvalidated(queryClient, ['kasif', 'catalog'])).toBe(true)
    expect(await publishingService.listVersions((await kitBySlug('blok-vitrini')).id)).toHaveLength(
      1,
    )
  })
})
