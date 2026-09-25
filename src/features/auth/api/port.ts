import type { StaffRole, StaffUser } from '@/entities/studio'

export type StaffSession = {
  user: StaffUser
  /** `aal2` after TOTP; admins need it for every Studio action. */
  aal: 'aal1' | 'aal2'
  expiresAt: string
}

/** What the login form does next. */
export type SignInResult =
  | { next: 'done'; session: StaffSession }
  | { next: 'mfa-verify'; session: StaffSession }
  | { next: 'mfa-enroll'; session: StaffSession }
  | { next: 'change-password'; session: StaffSession }

export type TotpEnrollment = { secret: string; uri: string }

/**
 * A password change. `currentPassword` is required unless the user signed in with a temporary
 * password (`mustChangePassword`) — then the fresh sign-in already proved it. Wrong current
 * passwords count toward the sign-in lockout (`rate_limited` once it trips).
 */
export type PasswordChange = { newPassword: string; currentPassword?: string | undefined }

/** ADR 0015: every feature talks to its backend through a port; adapters are mock | supabase. */
export type AuthService = {
  getSession(): StaffSession | null
  onChange(listener: () => void): () => void
  signIn(email: string, password: string): Promise<SignInResult>
  verifyTotp(code: string): Promise<SignInResult>
  startTotpEnrollment(): Promise<TotpEnrollment>
  confirmTotpEnrollment(code: string): Promise<SignInResult>
  changePassword(change: PasswordChange): Promise<SignInResult>
  signOut(): Promise<void>
  /** Test/demo only: pretend the session expired (the next call answers 401). */
  expireSession(): void
}

export type CreatedUser = { user: StaffUser; tempPassword: string }

export type UserAdminService = {
  list(): Promise<StaffUser[]>
  create(input: { email: string; displayName: string; role: StaffRole }): Promise<CreatedUser>
  resetPassword(userId: string): Promise<{ tempPassword: string }>
  setRole(userId: string, role: StaffRole): Promise<StaffUser>
  setActive(userId: string, active: boolean): Promise<StaffUser>
}
