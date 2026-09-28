import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'

import { isAppError } from '@/shared/api/errors'
import { resetSupabase, signedInDevice } from '@/test/supabase'

import { currentDeviceId, ensureDeviceSession, kidsClient } from './client'

afterEach(resetSupabase)

describe('ensureDeviceSession', () => {
  it('never replaces a session it only could not refresh with a new device', async () => {
    signedInDevice()
    vi.spyOn(kidsClient().auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('Service Unavailable', 503),
    })
    const signIn = vi.spyOn(kidsClient().auth, 'signInAnonymously')
    const error = await ensureDeviceSession().catch((failure: unknown) => failure)
    expect(isAppError(error)).toBe(true)
    expect(signIn).not.toHaveBeenCalled()
  })
})

describe('currentDeviceId', () => {
  it('names the device of a stored session', async () => {
    const id = signedInDevice()
    expect(await currentDeviceId()).toBe(id)
  })

  it('is null on a device that never joined', async () => {
    expect(await currentDeviceId()).toBeNull()
  })

  it('reports a session it cannot refresh offline as a network failure, not as no session', async () => {
    signedInDevice()
    vi.spyOn(kidsClient().auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    })
    const error = await currentDeviceId().catch((failure: unknown) => failure)
    expect(isAppError(error, 'network')).toBe(true)
  })

  it('is null once the server revoked the session', async () => {
    signedInDevice()
    vi.spyOn(kidsClient().auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    })
    expect(await currentDeviceId()).toBeNull()
  })
})
