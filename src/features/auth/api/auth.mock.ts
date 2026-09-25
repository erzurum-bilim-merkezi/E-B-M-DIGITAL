import { z } from 'zod'

import {
  checkPassword,
  PASSWORD_MESSAGES,
  staffUserSchema,
  type StaffRole,
  type StaffUser,
} from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { mockAuth, requireStaff } from '@/shared/api/mock-auth'
import { mockGate, mockTable, subscribeMockDb } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'
import { readJson, removeStorage, writeJson } from '@/shared/lib/storage'
import { generateTotpSecret, matchTotpStep, totpUri, verifyTotp } from '@/shared/lib/totp'

import type { AuthService, SignInResult, StaffSession, UserAdminService } from './port'

/** Staff session lives in sessionStorage: survives reloads, ends with the tab (ADR 0011). */
export const STAFF_SESSION_KEY = 'kasif:auth:staff'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_FAILED_SIGN_INS = 5
const LOCK_MS = 15 * 60 * 1000
const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000
const PBKDF2_ITERATIONS = 20_000
/** Salt for the throwaway hash of an unknown e-mail: every sign-in costs one PBKDF2 run. */
const UNKNOWN_USER_SALT = 'kasif-unknown-user'
const SIGN_IN_BUCKET = 'staff-sign-in'
const INVALID_SIGN_IN = 'E-posta ya da parola hatalı.'
const SIGN_IN_LOCKED = 'Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.'

const credentialSchema = z.object({
  userId: z.uuid(),
  passwordHash: z.string(),
  salt: z.string(),
  totpSecret: z.string().nullable(),
  failedAttempts: z.int().nonnegative(),
  lockedUntil: z.string().nullable(),
  tempPasswordExpiresAt: z.string().nullable(),
  // Second factor: attempt limit and replay protection (defaults keep older rows valid).
  totpFailedAttempts: z.int().nonnegative().default(0),
  totpLockedUntil: z.string().nullable().default(null),
  totpLastStep: z.int().nullable().default(null),
})
type Credential = z.infer<typeof credentialSchema>

const storedSessionSchema = z.object({
  userId: z.uuid(),
  aal: z.enum(['aal1', 'aal2']),
  expiresAt: z.string(),
  pendingTotpSecret: z.string().nullable(),
})
type StoredSession = z.infer<typeof storedSessionSchema>

export const staffUsers = mockTable(MOCK_TABLES.staffUsers, staffUserSchema)
const credentials = mockTable(MOCK_TABLES.staffCredentials, credentialSchema)
/** Failed sign-ins of e-mails without an account, so they lock exactly like real accounts. */
const unknownSignIns = mockTable(
  MOCK_TABLES.rateLimits,
  z.object({ bucket: z.string(), subject: z.string(), windowStart: z.string(), count: z.int() }),
)

function unknownSignInRow(email: string) {
  return unknownSignIns.find((row) => row.bucket === SIGN_IN_BUCKET && row.subject === email)
}

/** Same rule as a credential's `lockedUntil`: the 5th failure locks for 15 minutes. */
function unknownSignInLocked(email: string) {
  const row = unknownSignInRow(email)
  return (
    row !== undefined &&
    row.count >= MAX_FAILED_SIGN_INS &&
    Date.now() - Date.parse(row.windowStart) < LOCK_MS
  )
}

function recordUnknownSignInFailure(email: string) {
  const row = unknownSignInRow(email)
  // After an expired lock the count starts over, like a credential's `failedAttempts`.
  const previous = row && row.count < MAX_FAILED_SIGN_INS ? row.count : 0
  unknownSignIns.upsert(
    {
      bucket: SIGN_IN_BUCKET,
      subject: email,
      windowStart: new Date().toISOString(),
      count: previous + 1,
    },
    (entry) => `${entry.bucket}:${entry.subject}`,
  )
}

/** A wrong password (sign-in or current-password check): the 5th failure locks for 15 minutes. */
function recordPasswordFailure(userId: string) {
  credentials.update(
    (row) => row.userId === userId,
    (row) => {
      const failedAttempts = row.failedAttempts + 1
      const locks = failedAttempts >= MAX_FAILED_SIGN_INS
      return {
        ...row,
        failedAttempts: locks ? 0 : failedAttempts,
        lockedUntil: locks ? new Date(Date.now() + LOCK_MS).toISOString() : null,
      }
    },
  )
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** Readable one-time password: "Kasif-7Q2M-X9KA" style, satisfies the password policy. */
export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length] ?? 'A').join('')
  return `Gecici-${chars.slice(0, 4)}-${chars.slice(4)}7`
}

const listeners = new Set<() => void>()
function emit() {
  for (const listener of listeners) listener()
}

function readStored(): StoredSession | null {
  const result = storedSessionSchema.safeParse(readJson(STAFF_SESSION_KEY, 'session'))
  if (!result.success) return null
  if (Date.parse(result.data.expiresAt) <= Date.now()) return null
  return result.data
}

function writeStored(session: StoredSession | null) {
  if (session) writeJson(STAFF_SESSION_KEY, session, 'session')
  else removeStorage(STAFF_SESSION_KEY, 'session')
  emit()
}

function sessionFor(stored: StoredSession): StaffSession | null {
  const user = staffUsers.find((candidate) => candidate.id === stored.userId)
  if (!user || !user.active) return null
  return { user, aal: stored.aal, expiresAt: stored.expiresAt }
}

function nextStep(session: StaffSession, credential: Credential): SignInResult {
  const { user } = session
  if (user.role === 'admin' && session.aal !== 'aal2') {
    return credential.totpSecret ? { next: 'mfa-verify', session } : { next: 'mfa-enroll', session }
  }
  if (user.mustChangePassword) return { next: 'change-password', session }
  return { next: 'done', session }
}

/**
 * Replacing an existing authenticator needs a session that already proved it (aal2) —
 * otherwise a stolen password alone could enrol a new factor and reach aal2.
 */
function requireFactorOrAal2(stored: StoredSession, userId: string) {
  if (credentialOf(userId).totpSecret && stored.aal !== 'aal2') {
    throw new AppError(
      'forbidden',
      'Bu hesapta kayıtlı bir doğrulayıcı var. Önce onunla doğrulayın.',
    )
  }
}

function credentialOf(userId: string) {
  const credential = credentials.find((row) => row.userId === userId)
  if (!credential) throw new AppError('unauthorized')
  return credential
}

function requireStored() {
  const stored = readStored()
  if (!stored) throw new AppError('unauthorized')
  const session = sessionFor(stored)
  if (!session) {
    writeStored(null)
    throw new AppError('unauthorized', 'Hesabınız pasifleştirildi ya da oturum sona erdi.')
  }
  return { stored, session }
}

// The mock "JWT": other features' mock adapters ask who is calling (RLS stand-in).
mockAuth.setStaffResolver(() => {
  const stored = readStored()
  if (!stored) return null
  const user = staffUsers.find((candidate) => candidate.id === stored.userId)
  if (!user || !user.active) return null
  // A pending password change keeps the session from doing anything but changing it.
  if (user.mustChangePassword) return null
  return { userId: user.id, role: user.role, aal: stored.aal }
})

let cachedSessionKey = ''
let cachedSession: StaffSession | null = null

export function createMockAuthService(): AuthService {
  return {
    getSession() {
      const stored = readStored()
      const session = stored ? sessionFor(stored) : null
      // useSyncExternalStore needs the same object while nothing changed.
      const key = session ? JSON.stringify(session) : 'none'
      if (key !== cachedSessionKey) {
        cachedSessionKey = key
        cachedSession = session
      }
      return cachedSession
    },
    onChange(listener) {
      listeners.add(listener)
      const unsubscribeDb = subscribeMockDb(listener)
      return () => {
        listeners.delete(listener)
        unsubscribeDb()
      }
    },

    async signIn(email, password) {
      await mockGate('auth.signIn')
      const normalized = email.trim().toLowerCase()
      const user = staffUsers.find((candidate) => candidate.email.toLowerCase() === normalized)
      const invalid = new AppError('unauthorized', INVALID_SIGN_IN)
      if (!user) {
        // No enumeration: an unknown e-mail costs the same hash, gets the same answer and locks
        // after the same number of failures as a wrong password for a real account.
        if (unknownSignInLocked(normalized)) throw new AppError('rate_limited', SIGN_IN_LOCKED)
        await hashPassword(password, UNKNOWN_USER_SALT)
        recordUnknownSignInFailure(normalized)
        throw invalid
      }
      const credential = credentialOf(user.id)
      if (credential.lockedUntil && Date.parse(credential.lockedUntil) > Date.now()) {
        throw new AppError('rate_limited', SIGN_IN_LOCKED)
      }
      const hash = await hashPassword(password, credential.salt)
      if (hash !== credential.passwordHash) {
        recordPasswordFailure(user.id)
        throw invalid
      }
      if (!user.active)
        throw new AppError('forbidden', 'Hesabınız pasif. Bir yöneticiyle iletişime geçin.')
      if (
        credential.tempPasswordExpiresAt &&
        Date.parse(credential.tempPasswordExpiresAt) < Date.now()
      ) {
        throw new AppError(
          'unauthorized',
          'Geçici parolanın süresi doldu. Yöneticiden yeni parola isteyin.',
        )
      }
      credentials.update(
        (row) => row.userId === user.id,
        (row) => ({ ...row, failedAttempts: 0, lockedUntil: null }),
      )
      const now = new Date().toISOString()
      const updated =
        staffUsers.update(
          (row) => row.id === user.id,
          (row) => ({ ...row, lastSignInAt: now }),
        )[0] ?? user
      const stored: StoredSession = {
        userId: user.id,
        aal: 'aal1',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        pendingTotpSecret: null,
      }
      writeStored(stored)
      appendAudit({
        actorId: user.id,
        action: 'auth.sign_in',
        entity: 'staff_user',
        entityId: user.id,
      })
      return nextStep(
        { user: updated, aal: 'aal1', expiresAt: stored.expiresAt },
        credentialOf(user.id),
      )
    },

    async verifyTotp(code) {
      await mockGate('auth.verifyTotp')
      const { stored, session } = requireStored()
      const credential = credentialOf(session.user.id)
      if (credential.totpLockedUntil && Date.parse(credential.totpLockedUntil) > Date.now()) {
        throw new AppError(
          'rate_limited',
          'Çok fazla hatalı kod girildi. 15 dakika sonra tekrar deneyin.',
        )
      }
      const step = credential.totpSecret ? await matchTotpStep(credential.totpSecret, code) : null
      // Each code is accepted once: the same or an earlier time step fails (no replay).
      if (step === null || (credential.totpLastStep !== null && step <= credential.totpLastStep)) {
        const failures = credential.totpFailedAttempts + 1
        const locked = failures >= MAX_FAILED_SIGN_INS
        credentials.update(
          (row) => row.userId === session.user.id,
          (row) => ({
            ...row,
            totpFailedAttempts: locked ? 0 : failures,
            totpLockedUntil: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null,
          }),
        )
        throw new AppError(
          'validation',
          'Kod doğrulanamadı. Uygulamadaki güncel 6 haneli kodu girin.',
        )
      }
      credentials.update(
        (row) => row.userId === session.user.id,
        (row) => ({ ...row, totpFailedAttempts: 0, totpLockedUntil: null, totpLastStep: step }),
      )
      const next: StoredSession = { ...stored, aal: 'aal2' }
      writeStored(next)
      return nextStep({ ...session, aal: 'aal2' }, credential)
    },

    async startTotpEnrollment() {
      await mockGate('auth.startTotpEnrollment')
      const { stored, session } = requireStored()
      requireFactorOrAal2(stored, session.user.id)
      const secret = stored.pendingTotpSecret ?? generateTotpSecret()
      writeStored({ ...stored, pendingTotpSecret: secret })
      return { secret, uri: totpUri(secret, session.user.email) }
    },

    async confirmTotpEnrollment(code) {
      await mockGate('auth.confirmTotpEnrollment')
      const { stored, session } = requireStored()
      requireFactorOrAal2(stored, session.user.id)
      const secret = stored.pendingTotpSecret
      if (!secret || !(await verifyTotp(secret, code))) {
        throw new AppError(
          'validation',
          'Kod doğrulanamadı. Uygulamaya eklediğiniz hesabın kodunu girin.',
        )
      }
      credentials.update(
        (row) => row.userId === session.user.id,
        (row) => ({ ...row, totpSecret: secret }),
      )
      const user =
        staffUsers.update(
          (row) => row.id === session.user.id,
          (row) => ({ ...row, totpEnrolled: true }),
        )[0] ?? session.user
      writeStored({ ...stored, aal: 'aal2', pendingTotpSecret: null })
      appendAudit({
        actorId: user.id,
        action: 'auth.mfa_enrolled',
        entity: 'staff_user',
        entityId: user.id,
      })
      return nextStep({ user, aal: 'aal2', expiresAt: stored.expiresAt }, credentialOf(user.id))
    },

    async changePassword({ newPassword, currentPassword }) {
      await mockGate('auth.changePassword')
      const { stored, session } = requireStored()
      // An admin's password changes only with the second factor verified (aal2).
      if (session.user.role === 'admin' && stored.aal !== 'aal2') {
        throw new AppError('forbidden', 'Önce iki adımlı doğrulamayı tamamlayın.')
      }
      // A voluntary change needs the current password: an unattended session alone must not
      // take the account over. The forced change after a temporary password is exempt.
      // Wrong guesses share the sign-in lockout, so the session cannot brute-force it.
      if (!session.user.mustChangePassword) {
        const credential = credentialOf(session.user.id)
        if (credential.lockedUntil && Date.parse(credential.lockedUntil) > Date.now()) {
          throw new AppError('rate_limited', SIGN_IN_LOCKED)
        }
        const hash = await hashPassword(currentPassword ?? '', credential.salt)
        if (hash !== credential.passwordHash) {
          recordPasswordFailure(session.user.id)
          throw new AppError('validation', 'Mevcut parola hatalı.')
        }
      }
      const problem = checkPassword(newPassword)
      if (problem) throw new AppError('validation', PASSWORD_MESSAGES[problem])
      const salt = randomSalt()
      const passwordHash = await hashPassword(newPassword, salt)
      credentials.update(
        (row) => row.userId === session.user.id,
        (row) => ({
          ...row,
          salt,
          passwordHash,
          tempPasswordExpiresAt: null,
          failedAttempts: 0,
          lockedUntil: null,
        }),
      )
      const user =
        staffUsers.update(
          (row) => row.id === session.user.id,
          (row) => ({ ...row, mustChangePassword: false }),
        )[0] ?? session.user
      writeStored(stored)
      appendAudit({
        actorId: user.id,
        action: 'auth.password_changed',
        entity: 'staff_user',
        entityId: user.id,
      })
      return nextStep({ ...session, user }, credentialOf(user.id))
    },

    async signOut() {
      const stored = readStored()
      if (stored)
        appendAudit({
          actorId: stored.userId,
          action: 'auth.sign_out',
          entity: 'staff_user',
          entityId: stored.userId,
        })
      writeStored(null)
    },

    expireSession() {
      const stored = readStored()
      if (stored) writeStored({ ...stored, expiresAt: new Date(0).toISOString() })
    },
  }
}

function activeAdmins(excludeId?: string) {
  return staffUsers.count((user) => user.role === 'admin' && user.active && user.id !== excludeId)
}

export function createMockUserAdminService(): UserAdminService {
  return {
    async list() {
      await mockGate('users.list')
      requireStaff({ role: 'admin' })
      return staffUsers.all().toSorted((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))
    },

    async create({ email, displayName, role }) {
      await mockGate('users.create')
      const caller = requireStaff({ role: 'admin' })
      const normalized = email.trim().toLowerCase()
      if (!z.email().safeParse(normalized).success)
        throw new AppError('validation', 'Geçerli bir e-posta girin.')
      if (displayName.trim().length < 2)
        throw new AppError('validation', 'Ad en az 2 karakter olmalı.')
      if (staffUsers.find((user) => user.email.toLowerCase() === normalized)) {
        throw new AppError('conflict', 'Bu e-posta ile bir kullanıcı zaten var.')
      }
      const user: StaffUser = {
        id: crypto.randomUUID(),
        email: normalized,
        displayName: displayName.trim(),
        role,
        active: true,
        mustChangePassword: true,
        totpEnrolled: false,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
      }
      const tempPassword = generateTempPassword()
      const salt = randomSalt()
      staffUsers.insert(user)
      credentials.insert({
        userId: user.id,
        salt,
        passwordHash: await hashPassword(tempPassword, salt),
        totpSecret: null,
        failedAttempts: 0,
        lockedUntil: null,
        tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString(),
        totpFailedAttempts: 0,
        totpLockedUntil: null,
        totpLastStep: null,
      })
      appendAudit({
        actorId: caller.userId,
        action: 'user.created',
        entity: 'staff_user',
        entityId: user.id,
        meta: { role },
      })
      return { user, tempPassword }
    },

    async resetPassword(userId) {
      await mockGate('users.resetPassword')
      const caller = requireStaff({ role: 'admin' })
      const user = staffUsers.find((row) => row.id === userId)
      if (!user) throw new AppError('not_found')
      const tempPassword = generateTempPassword()
      const salt = randomSalt()
      const passwordHash = await hashPassword(tempPassword, salt)
      credentials.update(
        (row) => row.userId === userId,
        (row) => ({
          ...row,
          salt,
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString(),
          // An admin reset also lifts a second-factor lock; the replay guard (last step) stays.
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        }),
      )
      staffUsers.update(
        (row) => row.id === userId,
        (row) => ({ ...row, mustChangePassword: true }),
      )
      appendAudit({
        actorId: caller.userId,
        action: 'user.password_reset',
        entity: 'staff_user',
        entityId: userId,
      })
      return { tempPassword }
    },

    async setRole(userId, role: StaffRole) {
      await mockGate('users.setRole')
      const caller = requireStaff({ role: 'admin' })
      const user = staffUsers.find((row) => row.id === userId)
      if (!user) throw new AppError('not_found')
      if (user.role === 'admin' && role !== 'admin' && user.active && activeAdmins(userId) === 0) {
        throw new AppError(
          'conflict',
          'Son aktif yönetici düşürülemez. Önce başka bir yönetici ekleyin.',
        )
      }
      const updated =
        staffUsers.update(
          (row) => row.id === userId,
          (row) => ({ ...row, role }),
        )[0] ?? user
      appendAudit({
        actorId: caller.userId,
        action: 'user.role_changed',
        entity: 'staff_user',
        entityId: userId,
        meta: { role },
      })
      return updated
    },

    async setActive(userId, active) {
      await mockGate('users.setActive')
      const caller = requireStaff({ role: 'admin' })
      const user = staffUsers.find((row) => row.id === userId)
      if (!user) throw new AppError('not_found')
      if (!active && user.role === 'admin' && activeAdmins(userId) === 0) {
        throw new AppError('conflict', 'Son aktif yönetici pasifleştirilemez.')
      }
      const updated =
        staffUsers.update(
          (row) => row.id === userId,
          (row) => ({ ...row, active }),
        )[0] ?? user
      appendAudit({
        actorId: caller.userId,
        action: active ? 'user.activated' : 'user.deactivated',
        entity: 'staff_user',
        entityId: userId,
      })
      return updated
    },
  }
}

export type SeedStaff = {
  id: string
  email: string
  displayName: string
  role: StaffRole
  password: string
  totpSecret?: string
  mustChangePassword?: boolean
}

/** Demo/E2E seeding (runs before any session exists). */
export async function seedStaffUsers(users: readonly SeedStaff[]) {
  for (const seed of users) {
    if (staffUsers.find((user) => user.email === seed.email)) continue
    const salt = randomSalt()
    staffUsers.insert({
      id: seed.id,
      email: seed.email,
      displayName: seed.displayName,
      role: seed.role,
      active: true,
      mustChangePassword: seed.mustChangePassword ?? false,
      totpEnrolled: Boolean(seed.totpSecret),
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
    })
    credentials.insert({
      userId: seed.id,
      salt,
      // oxlint-disable-next-line no-await-in-loop -- sequential seeding: each user is inserted before the next duplicate-email check; PBKDF2 per user
      passwordHash: await hashPassword(seed.password, salt),
      totpSecret: seed.totpSecret ?? null,
      failedAttempts: 0,
      lockedUntil: null,
      tempPasswordExpiresAt: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
      totpLastStep: null,
    })
  }
}

/** E2E only: starts a fully verified session without the UI (`backend.loginAs`). */
export function injectStaffSession(userId: string) {
  writeStored({
    userId,
    aal: 'aal2',
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    pendingTotpSecret: null,
  })
}
