import { z } from 'zod'

import { createStoredValue } from '@/shared/hooks/stored-value'

/**
 * Device-local state of the Kâşif app. Everything about the explorer lives on the server; the
 * device keeps only its session, which member is active, and the codes it was shown.
 * All keys are `kasif:`-prefixed (shared github.io origin — ADR 0013).
 */

/** Anonymous device session (the mock's stand-in for `signInAnonymously`, ADR 0017). */
export const deviceSession = createStoredValue(
  'kasif:auth:kid',
  z.object({ deviceUid: z.uuid(), createdAt: z.string() }).nullable(),
  null,
)

export function ensureDeviceUid() {
  const current = deviceSession.get()
  if (current) return current.deviceUid
  const session = { deviceUid: crypto.randomUUID(), createdAt: new Date().toISOString() }
  deviceSession.set(session)
  return session.deviceUid
}

export const activeExplorerId = createStoredValue(
  'kasif:active-explorer:v1',
  z.uuid().nullable(),
  null,
)

/** Restore codes this device has seen (shown on the Kâşif card; the server keeps only hashes). */
export const knownCodes = createStoredValue(
  'kasif:explorer-codes:v1',
  z.record(z.string(), z.string()),
  {},
)

export function rememberCode(explorerId: string, code: string) {
  knownCodes.set({ ...knownCodes.get(), [explorerId]: code })
}

export function forgetCode(explorerId: string) {
  const { [explorerId]: _removed, ...rest } = knownCodes.get()
  knownCodes.set(rest)
}

/** Centre tablet hand-over: no code of an earlier child may stay on the device. */
export function forgetAllCodes() {
  knownCodes.set({})
}

/** Shared centre tablet (kiosk). */
export const centerDevice = createStoredValue(
  'kasif:center-device:v1',
  z.object({ id: z.uuid(), label: z.string() }).nullable(),
  null,
)
