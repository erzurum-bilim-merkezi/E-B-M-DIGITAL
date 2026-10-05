import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { MIN_APP_VERSION, type Catalog } from '@/entities/kit'
import { catalogQueryOptions } from '@/features/kit-catalog'
import { createTestQueryClient, renderHook } from '@/test/test-utils'

import { useAppUpdateReload } from './useAppUpdateReload'

function catalog(minAppVersion: number): Catalog {
  return { generatedAt: '2026-10-05T10:00:00.000Z', generation: 3, minAppVersion, kits: [] }
}

function renderReload(client: QueryClient) {
  const reload = vi.fn<() => void>()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const view = renderHook(() => useAppUpdateReload(reload), { wrapper })
  return { ...view, reload }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('useAppUpdateReload', () => {
  it('reloads once when published content needs a newer app', () => {
    const client = createTestQueryClient()
    client.setQueryData(catalogQueryOptions().queryKey, catalog(MIN_APP_VERSION + 1))

    const first = renderReload(client)
    first.rerender()
    const again = renderReload(client)

    expect(first.reload).toHaveBeenCalledOnce()
    // Still old after the reload: no loop, the app's own error pages take over.
    expect(again.reload).not.toHaveBeenCalled()
  })

  it('leaves an up-to-date app alone', () => {
    const client = createTestQueryClient()
    client.setQueryData(catalogQueryOptions().queryKey, catalog(MIN_APP_VERSION))

    expect(renderReload(client).reload).not.toHaveBeenCalled()
  })
})
