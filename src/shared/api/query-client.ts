import { QueryClient } from '@tanstack/react-query'

import { AppError } from './errors'
import { HttpError } from './http-client'

const MAX_RETRIES = 2

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // 4xx responses and permanent app errors will not succeed on retry.
        retry: (failureCount, error) =>
          !(error instanceof HttpError && error.isClientError) &&
          !(error instanceof AppError && error.isPermanent) &&
          failureCount < MAX_RETRIES,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
