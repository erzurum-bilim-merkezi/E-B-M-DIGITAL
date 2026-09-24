import { HttpError } from './http-client'
import { createQueryClient } from './query-client'

function getRetry() {
  const { retry } = createQueryClient().getDefaultOptions().queries ?? {}
  if (typeof retry !== 'function') throw new Error('Expected retry to be a function')
  return retry
}

describe('createQueryClient', () => {
  it('does not retry 4xx errors', () => {
    expect(getRetry()(0, new HttpError(404, 'Not found'))).toBe(false)
  })

  it('retries 5xx and network errors up to the limit', () => {
    const retry = getRetry()

    expect(retry(0, new HttpError(503, 'Unavailable'))).toBe(true)
    expect(retry(1, new TypeError('Failed to fetch'))).toBe(true)
    expect(retry(2, new TypeError('Failed to fetch'))).toBe(false)
  })

  it('never retries mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
  })
})
