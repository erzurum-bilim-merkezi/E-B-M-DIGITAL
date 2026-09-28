import { AppError, isAppError } from '@/shared/api/errors'

import { isAlreadyExists, isRangeNotSatisfiable, toAppError, unwrap, unwrapResult } from './errors'

/** An error of Supabase Auth with the given status and error code. */
const auth = (status: number, code?: string) =>
  toAppError({ __isAuthError: true, name: 'AuthApiError', status, code })

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

  it.each([
    ['anonymous sign-ins turned off', 'anonymous_provider_disabled'],
    ['sign-ups turned off', 'signup_disabled'],
    ['the Email provider turned off', 'email_provider_disabled'],
  ])('says the way in is closed, never "weak password", with %s', (_, code) => {
    const error = toAppError({ __isAuthError: true, name: 'AuthApiError', status: 422, code })
    expect(error.code).toBe('unavailable')
    expect(error.message).toBe('Giriş şu an kapalı. Lütfen bir görevliye haber verin.')
  })

  it('names password problems only for what they are', () => {
    expect(auth(422, 'weak_password').message).toBe('Parola yeterince güçlü değil.')
    expect(auth(422, 'same_password').message).toBe('Yeni parola eskisinden farklı olmalı.')
    // A stored session the server no longer knows is no wrong password.
    expect(auth(400, 'refresh_token_not_found').message).not.toBe('E-posta ya da parola hatalı.')
    // Without a code, the status still decides.
    expect(auth(422).message).toBe('Parola yeterince güçlü değil.')
    expect(auth(400).message).toBe('E-posta ya da parola hatalı.')
  })

  it('tells a deactivated Studio account why it cannot sign in', () => {
    const error = toAppError({
      __isAuthError: true,
      name: 'AuthApiError',
      status: 400,
      code: 'user_banned',
      message: 'User is banned',
    })
    expect(error.code).toBe('forbidden')
    expect(error.message).toBe('Hesabınız pasif. Bir yöneticiyle iletişime geçin.')
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

describe('error kinds the adapters handle themselves', () => {
  it('recognises an existing Storage object in every shape Storage reports it', () => {
    expect(isAlreadyExists({ status: 409, message: 'Conflict' })).toBe(true)
    expect(isAlreadyExists({ status: 400, statusCode: '409', message: 'Duplicate' })).toBe(true)
    expect(isAlreadyExists({ status: 400, message: 'The resource already exists' })).toBe(true)
    expect(isAlreadyExists({ status: 403, statusCode: '403', message: 'Unauthorized' })).toBe(false)
    expect(isAlreadyExists(null)).toBe(false)
  })

  it('recognises a page past the last row', () => {
    expect(isRangeNotSatisfiable({ code: 'PGRST103', message: 'Requested range' })).toBe(true)
    expect(isRangeNotSatisfiable({ code: 'PGRST116' })).toBe(false)
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
