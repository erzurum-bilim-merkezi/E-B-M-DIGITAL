import { z } from 'zod'

import {
  checkPassword,
  PASSWORD_MESSAGES,
  staffUserSchema,
  type StaffUser,
} from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import {
  STAFF_AUTH_KEY,
  staffClient,
  toAppError,
  unwrap,
  unwrapResult,
} from '@/shared/api/supabase'
import { readJson, removeStorage, writeJson } from '@/shared/lib/storage'

import type { AuthService, SignInResult, StaffSession, UserAdminService } from './port'

/*
 * Studio accounts on Supabase Auth (ADR 0011): email + password, TOTP for admins (aal2), a
 * temporary password that must be changed first. The session itself is supabase-js's (tab-scoped
 * sessionStorage). The router guards need it synchronously, so the Studio user it belongs to is
 * cached next to it (`kasif:studio-user:v1`) and refreshed at every step.
 */

const SNAPSHOT_KEY = 'kasif:studio-user:v1'

const snapshotSchema = z.object({
  user: staffUserSchema,
  aal: z.enum(['aal1', 'aal2']),
  expiresAt: z.string(),
})

const profileSchema = staffUserSchema.extend({ tempPasswordExpired: z.boolean() })

const listeners = new Set<() => void>()
let cachedKey = ''
let cached: StaffSession | null = null

function emit() {
  for (const listener of listeners) listener()
}

function writeSnapshot(session: StaffSession | null) {
  if (session) writeJson(SNAPSHOT_KEY, session, 'session')
  else removeStorage(SNAPSHOT_KEY, 'session')
  emit()
}

function readSnapshot(): StaffSession | null {
  const parsed = snapshotSchema.safeParse(readJson(SNAPSHOT_KEY, 'session'))
  return parsed.success ? parsed.data : null
}

function getSession() {
  const session = readSnapshot()
  // useSyncExternalStore needs the same object while nothing changed.
  const key = session ? JSON.stringify(session) : 'none'
  if (key !== cachedKey) {
    cachedKey = key
    cached = session
  }
  return cached
}

async function currentSession() {
  const { data } = await staffClient().auth.getSession()
  if (!data.session) throw new AppError('unauthorized')
  return data.session
}

async function assuranceLevel(): Promise<'aal1' | 'aal2'> {
  const { data } = await staffClient().auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal2' ? 'aal2' : 'aal1'
}

async function verifiedTotpFactor() {
  const { data, error } = await staffClient().auth.mfa.listFactors()
  if (error) throw toAppError(error)
  return data.totp.find((factor) => factor.status === 'verified') ?? null
}

async function profile(): Promise<z.infer<typeof profileSchema> | null> {
  const value = unwrap(await staffClient().rpc('my_staff_profile'))
  return value === null ? null : profileSchema.parse(value)
}

/** Refreshes the cached Studio user after a step and says what the login flow does next. */
async function next(): Promise<SignInResult> {
  const [session, user, aal] = await Promise.all([currentSession(), profile(), assuranceLevel()])
  if (!user) throw new AppError('unauthorized')
  const { tempPasswordExpired: _expired, ...staffUser } = user
  const current: StaffSession = {
    user: staffUser,
    aal,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  }
  writeSnapshot(current)
  if (staffUser.role === 'admin' && aal !== 'aal2') {
    return (await verifiedTotpFactor())
      ? { next: 'mfa-verify', session: current }
      : { next: 'mfa-enroll', session: current }
  }
  if (staffUser.mustChangePassword) return { next: 'change-password', session: current }
  return { next: 'done', session: current }
}

async function endSession() {
  await staffClient()
    .auth.signOut({ scope: 'local' })
    .catch(() => undefined)
  writeSnapshot(null)
}

let pendingFactorId: string | null = null
let subscribed = false

function subscribe() {
  if (subscribed) return
  subscribed = true
  staffClient().auth.onAuthStateChange((event) => {
    // Another tab cannot share this session (sessionStorage), so only sign-out and a failed
    // refresh end it here.
    if (event === 'SIGNED_OUT') writeSnapshot(null)
  })
}

export function createSupabaseAuthService(): AuthService {
  return {
    getSession,

    onChange(listener) {
      subscribe()
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async signIn(email, password) {
      const { error } = await staffClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw toAppError(error)
      const user = await profile()
      if (!user) {
        await endSession()
        throw new AppError('unauthorized', 'Bu hesap Kâşif Studio’ya kayıtlı değil.')
      }
      if (!user.active) {
        await endSession()
        throw new AppError('forbidden', 'Hesabınız pasif. Bir yöneticiyle iletişime geçin.')
      }
      if (user.tempPasswordExpired) {
        await endSession()
        throw new AppError(
          'unauthorized',
          'Geçici parolanın süresi doldu. Yöneticiden yeni parola isteyin.',
        )
      }
      return next()
    },

    async verifyTotp(code) {
      const factor = await verifiedTotpFactor()
      if (!factor) throw new AppError('unauthorized')
      const { error } = await staffClient().auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.replace(/\s/g, ''),
      })
      if (error) {
        const mapped = toAppError(error)
        throw mapped.code === 'rate_limited'
          ? new AppError(
              'rate_limited',
              'Çok fazla hatalı kod girildi. 15 dakika sonra tekrar deneyin.',
            )
          : new AppError(
              'validation',
              'Kod doğrulanamadı. Uygulamadaki güncel 6 haneli kodu girin.',
            )
      }
      return next()
    },

    async startTotpEnrollment() {
      await currentSession()
      // Replacing an authenticator needs a session that already proved the old one (aal2).
      if ((await verifiedTotpFactor()) && (await assuranceLevel()) !== 'aal2') {
        throw new AppError(
          'forbidden',
          'Bu hesapta kayıtlı bir doğrulayıcı var. Önce onunla doğrulayın.',
        )
      }
      // Unfinished earlier enrolments would block a new one with the same name.
      const { data: factors } = await staffClient().auth.mfa.listFactors()
      for (const factor of factors?.all ?? []) {
        if (factor.status === 'unverified') {
          // oxlint-disable-next-line no-await-in-loop -- at most a handful of stale factors
          await staffClient().auth.mfa.unenroll({ factorId: factor.id })
        }
      }
      const { data, error } = await staffClient().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Kâşif Studio ${new Date().toISOString().slice(0, 10)}`,
        issuer: 'Kâşif Studio',
      })
      if (error) throw toAppError(error)
      pendingFactorId = data.id
      return { secret: data.totp.secret, uri: data.totp.uri }
    },

    async confirmTotpEnrollment(code) {
      if (!pendingFactorId) throw new AppError('validation', 'Önce doğrulayıcıyı ekleyin.')
      const { error } = await staffClient().auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: code.replace(/\s/g, ''),
      })
      if (error) {
        throw new AppError(
          'validation',
          'Kod doğrulanamadı. Uygulamaya eklediğiniz hesabın kodunu girin.',
        )
      }
      pendingFactorId = null
      return next()
    },

    async changePassword({ newPassword, currentPassword }) {
      const session = getSession()
      if (!session) throw new AppError('unauthorized')
      if (session.user.role === 'admin' && session.aal !== 'aal2') {
        throw new AppError('forbidden', 'Önce iki adımlı doğrulamayı tamamlayın.')
      }
      if (!session.user.mustChangePassword) {
        unwrapResult(
          unwrap(
            await staffClient().rpc('verify_current_password', {
              p_password: currentPassword ?? '',
            }),
          ),
        )
      }
      const problem = checkPassword(newPassword)
      if (problem) throw new AppError('validation', PASSWORD_MESSAGES[problem])
      const { error } = await staffClient().auth.updateUser({ password: newPassword })
      if (error) {
        if ('code' in error && error.code === 'same_password') {
          throw new AppError('validation', 'Yeni parola eskisinden farklı olmalı.')
        }
        throw toAppError(error)
      }
      unwrap(await staffClient().rpc('complete_password_change'))
      return next()
    },

    async signOut() {
      await endSession()
    },

    expireSession() {
      // Test/demo hook: forget the session locally, as if it had run out.
      sessionStorage.removeItem(STAFF_AUTH_KEY)
      writeSnapshot(null)
    },
  }
}

// ---------------------------------------------------------------------------------------------
// User administration: listing and roles are plain RPCs; creating accounts, temporary passwords
// and bans need the auth admin API (admin-users Edge Function, called with the admin's JWT).
// ---------------------------------------------------------------------------------------------

const createdSchema = z.object({ user: staffUserSchema, tempPassword: z.string() })

async function adminUsers(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await staffClient().functions.invoke('admin-users', { body })
  if (error) {
    // FunctionsHttpError carries the function's JSON answer ({ code, message }).
    const context: unknown = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const payload: unknown = await context.json().catch(() => null)
      const parsed = z.object({ code: z.string(), message: z.string() }).safeParse(payload)
      if (parsed.success) throw toAppError({ code: parsed.data.code, message: parsed.data.message })
    }
    throw toAppError(error)
  }
  return data
}

export function createSupabaseUserAdminService(): UserAdminService {
  return {
    async list() {
      const users = z.array(staffUserSchema).parse(unwrap(await staffClient().rpc('staff_list')))
      return users.toSorted((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))
    },
    async create(input) {
      return createdSchema.parse(await adminUsers({ action: 'create', ...input }))
    },
    async resetPassword(userId) {
      return z
        .object({ tempPassword: z.string() })
        .parse(await adminUsers({ action: 'reset-password', userId }))
    },
    async setRole(userId, role): Promise<StaffUser> {
      return staffUserSchema.parse(
        unwrap(await staffClient().rpc('staff_update', { p_user: userId, p_role: role })),
      )
    },
    async setActive(userId, active) {
      return staffUserSchema.parse(await adminUsers({ action: 'set-active', userId, active }))
    },
  }
}
