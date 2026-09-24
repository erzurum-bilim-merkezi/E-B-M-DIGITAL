import { AppError } from './errors'

/**
 * Who is calling the mock backend — the mock counterpart of the JWT that supabase-js attaches
 * to every request. Features register resolvers (auth → staff session, explorer → device
 * session) so shared code stays domain-agnostic, and mock adapters enforce the same policies
 * the database's RLS will.
 */
export type StaffRole = 'admin' | 'editor'
export type MockStaffCaller = { userId: string; role: StaffRole; aal: 'aal1' | 'aal2' }

let staffResolver: () => MockStaffCaller | null = () => null
let deviceResolver: () => string | null = () => null
let systemDepth = 0

const SYSTEM_CALLER: MockStaffCaller = {
  userId: '00000000-0000-4000-8000-000000000000',
  role: 'admin',
  aal: 'aal2',
}

export const mockAuth = {
  setStaffResolver(resolver: () => MockStaffCaller | null) {
    staffResolver = resolver
  },
  setDeviceResolver(resolver: () => string | null) {
    deviceResolver = resolver
  },
  staff(): MockStaffCaller | null {
    return systemDepth > 0 ? SYSTEM_CALLER : staffResolver()
  },
  deviceUid(): string | null {
    return deviceResolver()
  },
  /** Runs privileged setup code (demo/E2E seeding) — like the service role in CI seeds. */
  async asSystem<T>(task: () => Promise<T>): Promise<T> {
    systemDepth++
    try {
      return await task()
    } finally {
      systemDepth--
    }
  },
}

type StaffRequirement = { role?: StaffRole; aal2?: boolean }

/** Throws unless an active staff session with the required role (and 2FA level) calls. */
export function requireStaff(requirement: StaffRequirement = {}): MockStaffCaller {
  const caller = mockAuth.staff()
  if (!caller) throw new AppError('unauthorized')
  if (requirement.role === 'admin' && caller.role !== 'admin') throw new AppError('forbidden')
  if ((requirement.aal2 ?? caller.role === 'admin') && caller.aal !== 'aal2') {
    throw new AppError('unauthorized', 'Bu işlem için iki adımlı doğrulama gerekli.')
  }
  return caller
}

/** Throws unless a Kâşif device session calls. */
export function requireDevice(): string {
  const deviceUid = mockAuth.deviceUid()
  if (!deviceUid) throw new AppError('unauthorized', 'Cihaz oturumu bulunamadı.')
  return deviceUid
}
