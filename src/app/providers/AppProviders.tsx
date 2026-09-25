import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { centerDevice } from '@/features/explorer'
import { createQueryClient } from '@/shared/api/query-client'
import { KIDS_QUERY_ROOT } from '@/shared/api/query-keys'
import { restoreQueries, saveQueries, type QuerySnapshot } from '@/shared/api/query-persistence'
import { isSupabaseBackend } from '@/shared/config/backend'
import { ErrorFallback, TooltipProvider } from '@/shared/ui'

// Loaded only in development so it never ships in the production bundle.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null

/**
 * The Kâşif app's members, progress and badges outlive a restart, so a child can open the app
 * without a connection (ADR 0021). Kit files come from the service worker cache; Studio data and
 * shared centre tablets are never kept. The mock backend keeps everything locally anyway.
 */
const KIDS_SNAPSHOT: QuerySnapshot = {
  key: 'kasif:kids-queries',
  include: (query) => query.queryKey[0] === KIDS_QUERY_ROOT && query.queryKey[1] !== 'content',
  buster: KASIF_BUILD_ID,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
}
const keepKidsData = () => !centerDevice.get()

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = createQueryClient()
    if (isSupabaseBackend && keepKidsData()) restoreQueries(client, KIDS_SNAPSHOT)
    return client
  })
  useEffect(
    () => (isSupabaseBackend ? saveQueries(queryClient, KIDS_SNAPSHOT, keepKidsData) : undefined),
    [queryClient],
  )

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Suspense fallback={null}>
          <ReactQueryDevtools buttonPosition="bottom-right" />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
