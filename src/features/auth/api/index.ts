import { isSupabaseBackend } from '@/shared/config/backend'

import { createMockAuthService, createMockUserAdminService } from './auth.mock'
import { createSupabaseAuthService, createSupabaseUserAdminService } from './auth.supabase'
import type { AuthService, UserAdminService } from './port'

// Adapter selection (ADR 0015).
export const authService: AuthService = isSupabaseBackend
  ? createSupabaseAuthService()
  : createMockAuthService()
export const userAdminService: UserAdminService = isSupabaseBackend
  ? createSupabaseUserAdminService()
  : createMockUserAdminService()

export type {
  AuthService,
  CreatedUser,
  PasswordChange,
  SignInResult,
  StaffSession,
  TotpEnrollment,
  UserAdminService,
} from './port'
