import type { z } from 'zod'

import { env } from '@/shared/config/env'

export class HttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500
  }
}

type QueryParams = Record<string, string | number | boolean | null | undefined>

export type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  query?: QueryParams
  /** Aborts the request after this many milliseconds. Defaults to 15s. */
  timeoutMs?: number
}

type TokenProvider = () => string | null | Promise<string | null>

let getAccessToken: TokenProvider = () => null

/** Wire the auth layer in once (e.g. from the auth feature) instead of importing it here. */
export function setAccessTokenProvider(provider: TokenProvider) {
  getAccessToken = provider
}

export function buildUrl(path: string, query?: QueryParams) {
  const base = env.VITE_API_BASE_URL.endsWith('/')
    ? env.VITE_API_BASE_URL
    : `${env.VITE_API_BASE_URL}/`
  const url = new URL(path.replace(/^\/+/, ''), base)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

async function request<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  { query, timeoutMs = 15_000, headers, signal, ...init }: RequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')

  const token = await getAccessToken()
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)

  const timeout = AbortSignal.timeout(timeoutMs)

  const response = await fetch(buildUrl(path, query), {
    ...init,
    method,
    headers: requestHeaders,
    body: body === undefined ? null : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })

  const data = await parseBody(response)

  if (!response.ok) {
    throw new HttpError(response.status, `${method} ${path} failed with ${response.status}`, data)
  }

  // Validate at the boundary: the rest of the app can trust these types.
  return schema.parse(data)
}

export const apiClient = {
  get: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) =>
    request('GET', path, schema, undefined, options),
  post: <T>(path: string, body: unknown, schema: z.ZodType<T>, options?: RequestOptions) =>
    request('POST', path, schema, body, options),
  put: <T>(path: string, body: unknown, schema: z.ZodType<T>, options?: RequestOptions) =>
    request('PUT', path, schema, body, options),
  patch: <T>(path: string, body: unknown, schema: z.ZodType<T>, options?: RequestOptions) =>
    request('PATCH', path, schema, body, options),
  delete: <T>(path: string, schema: z.ZodType<T>, options?: RequestOptions) =>
    request('DELETE', path, schema, undefined, options),
}
