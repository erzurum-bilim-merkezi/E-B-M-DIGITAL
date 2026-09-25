import { isAppError } from '@/shared/api/errors'
import { totpCode } from '@/shared/lib/totp'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

import { authService, DEMO_ACCOUNTS, DEMO_TOTP_SECRET, userAdminService } from '../index'

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!isAppError(error)) throw new Error(`expected an AppError, got ${String(error)}`)
  return error
}

describe('auth service (mock adapter)', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
  })

  it('signs an editor in with one factor', async () => {
    const result = await authService.signIn(
      DEMO_ACCOUNTS.editor.email,
      DEMO_ACCOUNTS.editor.password,
    )

    expect(result.next).toBe('done')
    expect(authService.getSession()?.user.role).toBe('editor')
    // Sessions live per tab (sessionStorage), never in localStorage.
    expect(Object.keys(localStorage).some((key) => key.includes('auth'))).toBe(false)
  })

  it('treats e-mail case-insensitively and rejects a wrong password without detail', async () => {
    const wrong = await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, 'yanlis-parola-1'))
    expect(wrong.code).toBe('unauthorized')

    const result = await authService.signIn(
      DEMO_ACCOUNTS.editor.email.toUpperCase(),
      DEMO_ACCOUNTS.editor.password,
    )
    expect(result.next).toBe('done')
  })

  it('locks an account after repeated wrong passwords', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts must happen one after another
      await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, `yanlis-${attempt}-parola`))
    }
    const locked = await failure(
      authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password),
    )
    expect(locked.code).toBe('rate_limited')
  })

  it('answers an unknown e-mail exactly like a wrong password, hash and lockout included', async () => {
    const deriveBits = vi.spyOn(crypto.subtle, 'deriveBits')
    const unknown = await failure(authService.signIn('kimse@kasif.dev', 'bir-parola-1'))
    const wrong = await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, 'bir-parola-1'))

    expect(deriveBits).toHaveBeenCalledTimes(2) // one PBKDF2 run each: no timing difference
    expect([unknown.code, unknown.message]).toEqual([wrong.code, wrong.message])
    deriveBits.mockRestore()

    for (let attempt = 1; attempt < 5; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts must happen one after another
      await failure(authService.signIn('KIMSE@kasif.dev', `yanlis-${attempt}-parola`))
    }
    for (let attempt = 1; attempt < 5; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts must happen one after another
      await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, `yanlis-${attempt}-parola`))
    }
    const unknownLocked = await failure(authService.signIn('kimse@kasif.dev', 'bir-parola-1'))
    const knownLocked = await failure(
      authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password),
    )
    expect(unknownLocked.code).toBe('rate_limited')
    expect([unknownLocked.code, unknownLocked.message]).toEqual([
      knownLocked.code,
      knownLocked.message,
    ])
    // The lock is per e-mail: another unknown address is still just "wrong".
    expect((await failure(authService.signIn('baska@kasif.dev', 'bir-parola-1'))).code).toBe(
      'unauthorized',
    )
  })

  it('changes a password only with the current one outside the temporary-password flow', async () => {
    await authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password)
    const newPassword = 'Yepyeni.Parola.42'

    const missing = await failure(authService.changePassword({ newPassword }))
    const wrong = await failure(
      authService.changePassword({ newPassword, currentPassword: 'yanlis-parola-1' }),
    )
    for (const error of [missing, wrong]) {
      expect(error.code).toBe('validation')
      expect(error.message).toBe('Mevcut parola hatalı.')
    }

    const done = await authService.changePassword({
      newPassword,
      currentPassword: DEMO_ACCOUNTS.editor.password,
    })
    expect(done.next).toBe('done')
    await authService.signOut()
    await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password))
    expect((await authService.signIn(DEMO_ACCOUNTS.editor.email, newPassword)).next).toBe('done')
  })

  it('locks the current-password check like sign-in, so a session cannot guess it', async () => {
    await authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password)
    const newPassword = 'Yepyeni.Parola.42'
    for (let attempt = 0; attempt < 5; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts must happen one after another
      await failure(
        authService.changePassword({ newPassword, currentPassword: `yanlis-${attempt}-parola` }),
      )
    }

    const locked = await failure(
      authService.changePassword({ newPassword, currentPassword: DEMO_ACCOUNTS.editor.password }),
    )
    expect(locked.code).toBe('rate_limited')
    await authService.signOut()
    const signIn = await failure(
      authService.signIn(DEMO_ACCOUNTS.editor.email, DEMO_ACCOUNTS.editor.password),
    )
    expect(signIn.code).toBe('rate_limited')
  })

  it('requires TOTP (aal2) for admins', async () => {
    const first = await authService.signIn(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
    expect(first.next).toBe('mfa-verify')
    expect(authService.getSession()?.aal).toBe('aal1')

    const valid = await totpCode(DEMO_TOTP_SECRET)
    const bad = await failure(authService.verifyTotp(valid === '000000' ? '111111' : '000000'))
    expect(bad.code).toBe('validation')

    const done = await authService.verifyTotp(valid)
    expect(done.next).toBe('done')
    expect(authService.getSession()?.aal).toBe('aal2')
  })

  it('accepts a TOTP code only once and locks after repeated wrong codes', async () => {
    await authService.signIn(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
    const code = await totpCode(DEMO_TOTP_SECRET)
    expect((await authService.verifyTotp(code)).next).toBe('done')

    // Same code again (e.g. shoulder-surfed): refused.
    await authService.signOut()
    await authService.signIn(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
    expect((await failure(authService.verifyTotp(code))).code).toBe('validation')

    for (let attempt = 0; attempt < 4; attempt++) {
      // oxlint-disable-next-line no-await-in-loop -- attempts happen one after another
      await failure(authService.verifyTotp(code === '000000' ? '111111' : '000000'))
    }
    const locked = await failure(authService.verifyTotp(await totpCode(DEMO_TOTP_SECRET)))
    expect(locked.code).toBe('rate_limited')
  })

  it('never lets a password-only admin session replace the factor or the password', async () => {
    const first = await authService.signIn(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password)
    expect(first.next).toBe('mfa-verify')

    expect((await failure(authService.startTotpEnrollment())).code).toBe('forbidden')
    expect((await failure(authService.confirmTotpEnrollment('123456'))).code).toBe('forbidden')
    const change = authService.changePassword({
      newPassword: 'Yepyeni.Parola.42',
      currentPassword: DEMO_ACCOUNTS.admin.password,
    })
    expect((await failure(change)).code).toBe('forbidden')
  })

  it('signs out and notifies listeners', async () => {
    const listener = vi.fn<() => void>()
    const unsubscribe = authService.onChange(listener)
    signInAs('editor')
    await authService.signOut()

    expect(authService.getSession()).toBeNull()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('treats an expired session as signed out', () => {
    signInAs('editor')
    authService.expireSession()

    expect(authService.getSession()).toBeNull()
  })
})

describe('user administration', () => {
  beforeEach(async () => {
    await seedMockBackend(MINIMAL_SEED)
    signInAs('admin')
  })

  it('creates a user with a one-time password who must change it and enrol TOTP if admin', async () => {
    const { user, tempPassword } = await userAdminService.create({
      email: 'yeni.editor@kasif.dev',
      displayName: 'Yeni Editör',
      role: 'editor',
    })
    expect(user.mustChangePassword).toBe(true)
    expect(tempPassword.length).toBeGreaterThanOrEqual(12)

    await authService.signOut()
    const first = await authService.signIn('yeni.editor@kasif.dev', tempPassword)
    expect(first.next).toBe('change-password')

    // A fresh sign-in with the temporary password is proof enough: no current password asked.
    const weak = await failure(authService.changePassword({ newPassword: 'kisa1' }))
    expect(weak.code).toBe('validation')
    const done = await authService.changePassword({ newPassword: 'Yepyeni.Parola.42' })
    expect(done.next).toBe('done')
    expect(authService.getSession()?.user.mustChangePassword).toBe(false)
  })

  it('refuses duplicate e-mails', async () => {
    const duplicate = await failure(
      userAdminService.create({
        email: DEMO_ACCOUNTS.editor.email,
        displayName: 'Kopya',
        role: 'editor',
      }),
    )
    expect(duplicate.code).toBe('conflict')
  })

  it('resets passwords, changes roles and deactivates users', async () => {
    const users = await userAdminService.list()
    const editor = users.find((user) => user.email === DEMO_ACCOUNTS.editor.email)!

    const { tempPassword } = await userAdminService.resetPassword(editor.id)
    expect(tempPassword).not.toBe(DEMO_ACCOUNTS.editor.password)

    expect((await userAdminService.setRole(editor.id, 'admin')).role).toBe('admin')
    expect((await userAdminService.setActive(editor.id, false)).active).toBe(false)
    await authService.signOut()
    const inactive = await failure(authService.signIn(DEMO_ACCOUNTS.editor.email, tempPassword))
    expect(['unauthorized', 'forbidden']).toContain(inactive.code)
  })

  it('never removes the last active admin', async () => {
    const users = await userAdminService.list()
    const second = users.find((user) => user.email === DEMO_ACCOUNTS.admin2.email)!
    const me = users.find((user) => user.email === DEMO_ACCOUNTS.admin.email)!

    await userAdminService.setActive(second.id, false)
    const lastAdmin = await failure(userAdminService.setRole(me.id, 'editor'))
    expect(lastAdmin.code).toBe('conflict')
    const deactivateSelf = await failure(userAdminService.setActive(me.id, false))
    expect(['conflict', 'forbidden']).toContain(deactivateSelf.code)
  })

  it('is admin-only', async () => {
    signInAs('editor')

    expect((await failure(userAdminService.list())).code).toBe('forbidden')
  })
})
