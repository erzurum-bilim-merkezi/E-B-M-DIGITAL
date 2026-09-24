import { http, HttpResponse } from 'msw'

import { buildUrl } from '@/shared/api/http-client'

// Default "happy path" handlers. Override per test with `server.use(...)`.
export const handlers = [
  http.get(buildUrl('/health').href, () => HttpResponse.json({ status: 'ok', version: '1.0.0' })),
]
