import { AppError, isAppError } from '@/shared/api/errors'

import { toAppError, unwrap, unwrapResult } from './errors'

describe('toAppError', () => {
  it('turns RPC errors (SQLSTATE KSxxx) into AppErrors with their message and details', () => {
    const error = toAppError({
      code: 'KS409',
      message: 'Bu kit başka bir yerde değiştirildi.',
      details: JSON.stringify({ latest: { lockVersion: 3 } }),
      hint: null,
    })

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('Bu kit başka bir yerde değiştirildi.')
    expect(error.details).toEqual({ latest: { lockVersion: 3 } })
  })

  it.each([
    [{ code: '42501', message: 'permission denied for table kits' }, 'forbidden'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'unauthorized'],
    [{ code: '23505', message: 'duplicate key' }, 'conflict'],
    [{ code: 'PGRST116', message: 'no rows' }, 'not_found'],
  ])('maps Postgres/PostgREST code %o to %s without leaking its text', (input, code) => {
    const error = toAppError(input)
    expect(error.code).toBe(code)
    expect(error.message).not.toContain(input.message)
  })

  it('maps sign-in failures to a Turkish message', () => {
    const error = toAppError({
      __isAuthError: true,
      name: 'AuthApiError',
      status: 400,
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
    })
    expect(error.code).toBe('unauthorized')
    expect(error.message).toBe('E-posta ya da parola hatalı.')
  })

  it('treats a failed fetch as a network error (retryable)', () => {
    const error = toAppError(new TypeError('Failed to fetch'))
    expect(error.code).toBe('network')
    expect(error.isPermanent).toBe(false)
  })

  it('passes AppErrors through and maps unknown values to "unavailable"', () => {
    const original = new AppError('quota')
    expect(toAppError(original)).toBe(original)
    expect(toAppError('boom').code).toBe('unavailable')
  })
})

describe('unwrap', () => {
  it('returns data or throws the mapped error', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1)
    expect(() => unwrap({ data: null, error: { code: 'KS403', message: 'Hayır.' } })).toThrow(
      'Hayır.',
    )
  })
})

describe('unwrapResult', () => {
  it('throws error values of counting RPCs as AppErrors', () => {
    let thrown: unknown
    try {
      unwrapResult({
        ok: false,
        error: {
          code: 'not_found',
          message: 'Bu Kâşif kodu bulunamadı.',
          details: { remaining: 3 },
        },
      })
    } catch (error) {
      thrown = error
    }
    expect(isAppError(thrown, 'not_found')).toBe(true)
    expect(isAppError(thrown) && thrown.details).toEqual({ remaining: 3 })
  })

  it('returns successful results', () => {
    expect(unwrapResult({ ok: true, device: { id: 'x' } })).toEqual({
      ok: true,
      device: { id: 'x' },
    })
  })
})
