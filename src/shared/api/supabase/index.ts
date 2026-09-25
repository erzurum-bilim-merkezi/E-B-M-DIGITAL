// Supabase access for the *.supabase.ts adapters (ADR 0015). Features never import supabase-js.
export {
  currentDeviceId,
  ensureDeviceSession,
  KIDS_AUTH_KEY,
  kidsClient,
  publicObjectUrl,
  resetSupabaseClients,
  STAFF_AUTH_KEY,
  staffClient,
} from './client'
export { toAppError, unwrap, unwrapResult } from './errors'
