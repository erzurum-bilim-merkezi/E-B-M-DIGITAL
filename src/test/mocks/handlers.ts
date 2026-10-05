import { http, HttpResponse } from 'msw'

import { buildUrl } from '@/shared/api/http-client'

/** Stand-in for the three.js runtime of interactive pages (the real one is ≈ 900 kB). */
export const PAGE_RUNTIME_SOURCE = 'export const REVISION = "test"'

// Default "happy path" handlers. Override per test with `server.use(...)`.
export const handlers = [
  http.get(buildUrl('/health').href, () => HttpResponse.json({ status: 'ok', version: '1.0.0' })),
  http.get(
    new URL(`${import.meta.env.BASE_URL}${KASIF_PAGE_RUNTIME}`, window.location.origin).href,
    () =>
      new HttpResponse(PAGE_RUNTIME_SOURCE, {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
      }),
  ),
]
