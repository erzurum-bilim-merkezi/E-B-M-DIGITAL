import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { PAGE_RUNNER_FILE } from '@/shared/config/page-runner'

import { apiClient } from './http-client'

/*
 * Interactive pages (ADR 0023): the page runner document and the three.js runtime the app hands
 * it. Both are files of this site; their names come from vite.config.ts.
 */

function siteUrl(file: string) {
  return new URL(`${import.meta.env.BASE_URL}${file}`, window.location.origin).href
}

export const pageRunnerUrl = () => siteUrl(PAGE_RUNNER_FILE)

export const pageRuntimeKeys = {
  all: ['page-runtime'] as const,
  file: (file: string) => [...pageRuntimeKeys.all, file] as const,
}

/**
 * The runtime's source (≈ 900 kB, ≈ 220 kB gzipped). Fetched once on the first page, then kept
 * for the session (its versioned name never changes; the service worker caches it too).
 */
export function pageRuntimeQueryOptions() {
  return queryOptions({
    queryKey: pageRuntimeKeys.file(KASIF_PAGE_RUNTIME),
    queryFn: ({ signal }) =>
      apiClient.get(siteUrl(KASIF_PAGE_RUNTIME), z.string().min(1), { signal, timeoutMs: 60_000 }),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 1,
  })
}
