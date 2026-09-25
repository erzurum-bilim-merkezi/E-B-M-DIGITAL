import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import { server } from '@/test/mocks/server'

import { apiClient, buildUrl, HttpError, setAccessTokenProvider } from './http-client'

const itemSchema = z.object({ id: z.number(), name: z.string() })

describe('buildUrl', () => {
  it('joins the path to the API base URL and skips empty query params', () => {
    const url = buildUrl('/items', { page: 2, q: 'a b', empty: undefined, none: null })

    expect(url.pathname).toMatch(/\/items$/)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('q')).toBe('a b')
    expect(url.searchParams.has('empty')).toBe(false)
    expect(url.searchParams.has('none')).toBe(false)
  })

  it('keeps absolute URLs (published snapshots on the Supabase CDN)', () => {
    const url = buildUrl('https://abcd.supabase.co/storage/v1/object/public/published/catalog.json')

    expect(url.href).toBe(
      'https://abcd.supabase.co/storage/v1/object/public/published/catalog.json',
    )
  })
})

describe('apiClient', () => {
  afterEach(() => setAccessTokenProvider(() => null))

  it('returns schema-validated data', async () => {
    server.use(http.get(buildUrl('/items/1').href, () => HttpResponse.json({ id: 1, name: 'A' })))

    await expect(apiClient.get('/items/1', itemSchema)).resolves.toEqual({ id: 1, name: 'A' })
  })

  it('rejects when the response does not match the schema', async () => {
    server.use(http.get(buildUrl('/items/1').href, () => HttpResponse.json({ id: 'x' })))

    await expect(apiClient.get('/items/1', itemSchema)).rejects.toBeInstanceOf(z.ZodError)
  })

  it('throws HttpError with status and body for non-2xx responses', async () => {
    server.use(
      http.get(buildUrl('/items/404').href, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    )

    const error = await apiClient.get('/items/404', itemSchema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({
      status: 404,
      body: { message: 'Not found' },
      isClientError: true,
    })
  })

  it('sends JSON body and bearer token when a token provider is set', async () => {
    setAccessTokenProvider(() => 'secret-token')
    let received: { auth: string | null; body: unknown } | undefined

    server.use(
      http.post(buildUrl('/items').href, async ({ request }) => {
        received = { auth: request.headers.get('authorization'), body: await request.json() }
        return HttpResponse.json({ id: 2, name: 'B' }, { status: 201 })
      }),
    )

    await apiClient.post('/items', { name: 'B' }, itemSchema)

    expect(received).toEqual({ auth: 'Bearer secret-token', body: { name: 'B' } })
  })

  it('handles 204 No Content', async () => {
    server.use(
      http.delete(buildUrl('/items/1').href, () => new HttpResponse(null, { status: 204 })),
    )

    await expect(apiClient.delete('/items/1', z.undefined())).resolves.toBeUndefined()
  })
})
