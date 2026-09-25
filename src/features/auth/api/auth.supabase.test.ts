import { http, HttpResponse } from 'msw'

import { isAppError } from '@/shared/api/errors'
import { STAFF_AUTH_KEY } from '@/shared/api/supabase'
import { server } from '@/test/mocks/server'
import { fakeJwt, resetSupabase, rpc, signedInStaff, SUPABASE_URL } from '@/test/supabase'

import { createSupabaseAuthService, createSupabaseUserAdminService } from './auth.supabase'

const auth = createSupabaseAuthService()
const admins = createSupabaseUserAdminService()

const USER_ID = '6f1c2d4e-8a9b-4c3d-9e2f-1a2b3c4d5e6f'
const FACTOR_ID = '0b8f1a52-3c4d-4e5f-8a6b-7c8d9e0f1a2b'

function staffUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'deniz@kasif.dev',
    displayName: 'Deniz Yılmaz',
    role: 'admin',
    active: true,
    mustChangePassword: false,
    totpEnrolled: true,
    createdAt: '2026-09-01T10:00:00+00:00',
    lastSignInAt: null,
    ...overrides,
  }
}

function session(aal: 'aal1' | 'aal2') {
  return {
    access_token: fakeJwt({ sub: USER_ID, aal, is_anonymous: false }),
    token_type: 'bearer',
    expires_in: 1800,
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    refresh_token: 'refresh',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      email: 'deniz@kasif.dev',
      app_metadata: {},
      user_metadata: {},
    },
  }
}

/** GoTrue: password grant, the user with its factors, TOTP challenge/verify, logout. */
function goTrue({ factors = [{ id: FACTOR_ID, factor_type: 'totp', status: 'verified' }] } = {}) {
  const log: string[] = []
  server.use(
    http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
      log.push('password')
      return HttpResponse.json(session('aal1'))
    }),
    http.get(`${SUPABASE_URL}/auth/v1/user`, () =>
      HttpResponse.json({ ...session('aal1').user, factors }),
    ),
    http.post(`${SUPABASE_URL}/auth/v1/factors/:id/challenge`, () =>
      HttpResponse.json({ id: 'challenge-1', type: 'totp', expires_at: Date.now() / 1000 + 300 }),
    ),
    http.post(`${SUPABASE_URL}/auth/v1/factors/:id/verify`, async ({ request }) => {
      const body = (await request.json()) as { code?: string }
      log.push(`verify:${body.code ?? ''}`)
      return body.code === '123456'
        ? HttpResponse.json(session('aal2'))
        : HttpResponse.json(
            { code: 'mfa_verification_failed', message: 'Invalid TOTP code' },
            { status: 422 },
          )
    }),
    http.post(`${SUPABASE_URL}/auth/v1/logout`, () => {
      log.push('logout')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return log
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

afterEach(async () => {
  await auth.signOut().catch(() => undefined)
  resetSupabase()
})

describe('Supabase auth service', () => {
  it('asks an admin for the TOTP code, then reaches aal2', async () => {
    goTrue()
    rpc('my_staff_profile', () => ({ ...staffUser(), tempPasswordExpired: false }))

    const first = await auth.signIn(' Deniz@Kasif.dev ', 'Parola.1234')
    expect(first.next).toBe('mfa-verify')
    expect(auth.getSession()).toMatchObject({ aal: 'aal1', user: { role: 'admin' } })

    const second = await auth.verifyTotp('123 456')
    expect(second.next).toBe('done')
    expect(auth.getSession()?.aal).toBe('aal2')
    // The router reads the same object until something changes (useSyncExternalStore).
    expect(auth.getSession()).toBe(auth.getSession())
  })

  it('sends an admin without an authenticator to the enrolment', async () => {
    goTrue({ factors: [] })
    rpc('my_staff_profile', () => ({
      ...staffUser({ totpEnrolled: false }),
      tempPasswordExpired: false,
    }))
    expect((await auth.signIn('deniz@kasif.dev', 'Parola.1234')).next).toBe('mfa-enroll')
  })

  it('refuses a wrong TOTP code with a clear message', async () => {
    goTrue()
    rpc('my_staff_profile', () => ({ ...staffUser(), tempPasswordExpired: false }))
    await auth.signIn('deniz@kasif.dev', 'Parola.1234')
    const error = await failure(auth.verifyTotp('000000'))
    expect(isAppError(error, 'validation') && error.message).toMatch(/Kod doğrulanamadı/)
  })

  it('asks an editor with a temporary password to change it first', async () => {
    goTrue({ factors: [] })
    rpc('my_staff_profile', () => ({
      ...staffUser({ role: 'editor', mustChangePassword: true, totpEnrolled: false }),
      tempPasswordExpired: false,
    }))
    expect((await auth.signIn('deniz@kasif.dev', 'Gecici-AAAA-BBBB7')).next).toBe('change-password')
  })

  it('refuses an expired temporary password and ends the session', async () => {
    const log = goTrue({ factors: [] })
    rpc('my_staff_profile', () => ({
      ...staffUser({ role: 'editor', mustChangePassword: true }),
      tempPasswordExpired: true,
    }))
    const error = await failure(auth.signIn('deniz@kasif.dev', 'Gecici-AAAA-BBBB7'))
    expect(isAppError(error, 'unauthorized') && error.message).toMatch(/süresi doldu/)
    expect(log).toContain('logout')
    expect(auth.getSession()).toBeNull()
  })

  it('maps wrong credentials to a Turkish message', async () => {
    server.use(
      http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
        HttpResponse.json(
          { code: 'invalid_credentials', message: 'Invalid login credentials' },
          { status: 400 },
        ),
      ),
    )
    const error = await failure(auth.signIn('deniz@kasif.dev', 'yanlis'))
    expect(isAppError(error, 'unauthorized') && error.message).toBe('E-posta ya da parola hatalı.')
  })

  it('checks the current password before a voluntary change', async () => {
    goTrue()
    rpc('my_staff_profile', () => ({
      ...staffUser({ role: 'editor' }),
      tempPasswordExpired: false,
    }))
    await auth.signIn('deniz@kasif.dev', 'Parola.1234')
    rpc('verify_current_password', () => ({
      ok: false,
      error: { code: 'validation', message: 'Mevcut parola hatalı.', details: { remaining: 4 } },
    }))
    const error = await failure(
      auth.changePassword({ newPassword: 'Yepyeni.Parola.42', currentPassword: 'yanlis' }),
    )
    expect(isAppError(error, 'validation') && error.message).toBe('Mevcut parola hatalı.')
  })

  it('changes the password, clears the flag and signs out cleanly', async () => {
    const log = goTrue({ factors: [] })
    const profiles = [
      { ...staffUser({ role: 'editor', mustChangePassword: true }), tempPasswordExpired: false },
      { ...staffUser({ role: 'editor' }), tempPasswordExpired: false },
    ]
    rpc('my_staff_profile', () => profiles[0])
    await auth.signIn('deniz@kasif.dev', 'Gecici-AAAA-BBBB7')

    const updates: unknown[] = []
    server.use(
      http.put(`${SUPABASE_URL}/auth/v1/user`, async ({ request }) => {
        updates.push(await request.json())
        return HttpResponse.json({ ...session('aal1').user })
      }),
    )
    const completed = rpc('complete_password_change', () => profiles[1])
    rpc('my_staff_profile', () => profiles[1])

    const result = await auth.changePassword({ newPassword: 'Yepyeni.Parola.42' })

    expect(updates).toEqual([expect.objectContaining({ password: 'Yepyeni.Parola.42' })])
    expect(completed).toHaveLength(1)
    expect(result.next).toBe('done')
    await auth.signOut()
    expect(log).toContain('logout')
    expect(sessionStorage.getItem(STAFF_AUTH_KEY)).toBeNull()
    expect(auth.getSession()).toBeNull()
  })

  it('enforces the password policy before calling the server', async () => {
    goTrue({ factors: [] })
    rpc('my_staff_profile', () => ({
      ...staffUser({ role: 'editor', mustChangePassword: true }),
      tempPasswordExpired: false,
    }))
    await auth.signIn('deniz@kasif.dev', 'Gecici-AAAA-BBBB7')
    const error = await failure(auth.changePassword({ newPassword: 'kisa' }))
    expect(isAppError(error, 'validation')).toBe(true)
  })
})

describe('Supabase user administration', () => {
  beforeEach(() => signedInStaff(USER_ID))

  it('creates accounts through the admin-users function', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post(`${SUPABASE_URL}/functions/v1/admin-users`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          user: staffUser({ role: 'editor' }),
          tempPassword: 'Gecici-AAAA-BBBB7',
        })
      }),
    )
    const created = await admins.create({
      email: 'yeni@kasif.dev',
      displayName: 'Yeni',
      role: 'editor',
    })
    expect(bodies).toEqual([
      { action: 'create', email: 'yeni@kasif.dev', displayName: 'Yeni', role: 'editor' },
    ])
    expect(created.tempPassword).toBe('Gecici-AAAA-BBBB7')
  })

  it('passes the function’s refusal on as an AppError', async () => {
    server.use(
      http.post(`${SUPABASE_URL}/functions/v1/admin-users`, () =>
        HttpResponse.json(
          { code: 'KS409', message: 'Son aktif yönetici kaldırılamaz.' },
          { status: 409 },
        ),
      ),
    )
    const error = await failure(admins.setActive(USER_ID, false))
    expect(isAppError(error, 'conflict') && error.message).toBe('Son aktif yönetici kaldırılamaz.')
  })

  it('changes roles and lists accounts with plain RPCs', async () => {
    const calls = rpc('staff_update', () => staffUser({ role: 'editor' }))
    rpc('staff_list', () => [
      staffUser({ displayName: 'Zeynep' }),
      staffUser({ displayName: 'Ali' }),
    ])
    await admins.setRole(USER_ID, 'editor')
    expect(calls).toEqual([{ p_user: USER_ID, p_role: 'editor' }])
    expect((await admins.list()).map((user) => user.displayName)).toEqual(['Ali', 'Zeynep'])
  })
})
