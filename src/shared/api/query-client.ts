import { QueryClient } from '@tanstack/react-query'

import { HttpError } from './http-client'

const MAX_RETRIES = 2

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // 4xx responses will not succeed on retry; only retry network/5xx failures.
        retry: (failureCount, error) =>
          !(error instanceof HttpError && error.isClientError) && failureCount < MAX_RETRIES,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
