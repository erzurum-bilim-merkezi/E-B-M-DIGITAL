// Supabase access for the *.supabase.ts adapters (ADR 0015). Features never import supabase-js.
export {
  currentDeviceId,
  ensureDeviceSession,
  KIDS_AUTH_KEY,
  kidsClient,
  mediaBucket,
  mediaObjectUrl,
  publicObjectUrl,
  resetSupabaseClients,
  STAFF_AUTH_KEY,
  staffClient,
  type PublicBucket,
} from './client'
export { isAlreadyExists, isRangeNotSatisfiable, toAppError, unwrap, unwrapResult } from './errors'
export { readAll } from './read-all'
