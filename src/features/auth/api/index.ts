import { createMockAuthService, createMockUserAdminService } from './auth.mock'
import type { AuthService, UserAdminService } from './port'

// Adapter selection (ADR 0015). The Supabase adapters (`auth.supabase.ts`) arrive with F4.
export const authService: AuthService = createMockAuthService()
export const userAdminService: UserAdminService = createMockUserAdminService()

export type {
  AuthService,
  CreatedUser,
  SignInResult,
  StaffSession,
  TotpEnrollment,
  UserAdminService,
} from './port'
