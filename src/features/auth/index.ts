// Public API of the auth feature (staff sign-in, 2FA, user administration).
export { authService, userAdminService } from './api'
export type { SignInResult, StaffSession } from './api'
export { staffKeys, usersQueryOptions, useSignOut, useStaffSession } from './api/queries'
export { DEMO_ACCOUNTS, DEMO_TOTP_SECRET } from './api/demo-accounts'
export {
  injectStaffSession,
  seedStaffUsers,
  STAFF_SESSION_KEY,
  type SeedStaff,
} from './api/auth.mock'
export { LoginForm } from './components/LoginForm'
export { MfaEnrollForm, MfaVerifyForm } from './components/MfaForms'
export { ChangePasswordForm } from './components/ChangePasswordForm'
export { DemoAccountsHint, DemoTotpHint } from './components/DemoHints'
export { UsersManager } from './components/UsersManager'
