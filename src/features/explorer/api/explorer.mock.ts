import { z } from 'zod'

import { storedEventSchema } from '@/entities/activity'
import {
  checkNickname,
  cleanNickname,
  DEFAULT_EXPLORER_SETTINGS,
  earnedBadgeSchema,
  explorerProgressSchema,
  explorerSchema,
  formatNickname,
  generateDisplayCode,
  generateRestoreCode,
  hashCenterPin,
  hashRestoreCode,
  NICKNAME_MESSAGES,
  normalizeRestoreCode,
  type Explorer,
} from '@/entities/explorer'
import { centerDeviceSchema } from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { mockAuth, requireDevice } from '@/shared/api/mock-auth'
import { mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_TABLES } from '@/shared/api/mock-tables'

import {
  centerDevice,
  deviceSession,
  ensureDeviceUid,
  forgetAllCodes,
  forgetCode,
  rememberCode,
} from './device'
import type { ExplorerService } from './port'

export const explorersTable = mockTable(MOCK_TABLES.explorers, explorerSchema)
export const devicesTable = mockTable(
  MOCK_TABLES.explorerDevices,
  z.object({
    explorerId: z.uuid(),
    deviceUid: z.uuid(),
    linkedAt: z.string(),
    lastSeenAt: z.string(),
  }),
)
const secretsTable = mockTable(
  MOCK_TABLES.explorerSecrets,
  z.object({ explorerId: z.uuid(), restoreCodeHash: z.string() }),
)
const centerTable = mockTable(MOCK_TABLES.centerDevices, centerDeviceSchema)
const rateTable = mockTable(
  MOCK_TABLES.rateLimits,
  z.object({ bucket: z.string(), subject: z.string(), windowStart: z.string(), count: z.int() }),
)
const eventsTable = mockTable(MOCK_TABLES.explorerEvents, storedEventSchema)
const progressTable = mockTable(MOCK_TABLES.explorerProgress, explorerProgressSchema)
const badgesTable = mockTable(MOCK_TABLES.explorerBadges, earnedBadgeSchema)

/** A personal device may hold up to 10 members; a centre tablet seats one at a time (ADR 0009). */
export const MAX_EXPLORERS_PER_DEVICE = 10
/** Wrong restore codes, centre PINs and setup codes: 5 failures lock the device for 15 min. */
const MAX_FAILED_ATTEMPTS = 5
const ATTEMPT_LOCK_MS = 15 * 60 * 1000
type AttemptBucket = 'restore' | 'center-pin' | 'center-setup'

const RESTORE_LOCKED =
  'Çok fazla yanlış deneme oldu. 15 dakika sonra tekrar dene ya da eğitmenine sor.'
const PIN_LOCKED = 'Çok fazla yanlış PIN denendi. 15 dakika sonra tekrar deneyin.'
const SETUP_LOCKED = 'Çok fazla yanlış kurulum kodu denendi. 15 dakika sonra tekrar deneyin.'

// The mock "anonymous JWT": created lazily like `signInAnonymously` on first use.
mockAuth.setDeviceResolver(() => deviceSession.get()?.deviceUid ?? null)

function isCenterDevice(deviceUid: string) {
  return (
    centerTable.find((row) => row.deviceUid === deviceUid && row.revokedAt === null) !== undefined
  )
}

function linkedIds(deviceUid: string) {
  return new Set(
    devicesTable.filter((row) => row.deviceUid === deviceUid).map((row) => row.explorerId),
  )
}

function requireLinked(explorerId: string) {
  const deviceUid = requireDevice()
  if (!linkedIds(deviceUid).has(explorerId))
    throw new AppError('forbidden', 'Bu kâşif bu cihaza bağlı değil.')
  const explorer = explorersTable.find((row) => row.id === explorerId)
  if (!explorer) throw new AppError('not_found', 'Kâşif üyeliği bulunamadı.')
  return { deviceUid, explorer }
}

function link(explorerId: string, deviceUid: string) {
  const now = new Date().toISOString()
  devicesTable.upsert(
    { explorerId, deviceUid, linkedAt: now, lastSeenAt: now },
    (row) => `${row.explorerId}:${row.deviceUid}`,
  )
}

function assertCanLinkMore(deviceUid: string, explorerId?: string) {
  const ids = linkedIds(deviceUid)
  if (explorerId && ids.has(explorerId)) return
  if (!isCenterDevice(deviceUid) && ids.size >= MAX_EXPLORERS_PER_DEVICE) {
    throw new AppError('conflict', 'Bu cihaza en fazla 10 kâşif eklenebilir. Önce birini çıkarın.')
  }
}

function attemptRow(bucket: AttemptBucket, deviceUid: string) {
  return rateTable.find((entry) => entry.bucket === bucket && entry.subject === deviceUid)
}

/**
 * Failed attempts of one device (`rate_limit_counters`). Failures count for 15 minutes from the
 * first one; the 5th failure locks the bucket for 15 minutes counted from that failure
 * (`windowStart` then marks the start of the lock).
 */
function attemptState(bucket: AttemptBucket, deviceUid: string) {
  const row = attemptRow(bucket, deviceUid)
  if (!row || Date.now() - Date.parse(row.windowStart) > ATTEMPT_LOCK_MS) {
    return { locked: false, failures: 0 }
  }
  return { locked: row.count >= MAX_FAILED_ATTEMPTS, failures: row.count }
}

function assertNotLocked(bucket: AttemptBucket, deviceUid: string, message: string) {
  if (attemptState(bucket, deviceUid).locked) throw new AppError('rate_limited', message)
}

function recordFailure(bucket: AttemptBucket, deviceUid: string) {
  const failures = attemptState(bucket, deviceUid).failures + 1
  const locked = failures >= MAX_FAILED_ATTEMPTS
  const firstFailure = failures > 1 ? attemptRow(bucket, deviceUid)?.windowStart : undefined
  rateTable.upsert(
    {
      bucket,
      subject: deviceUid,
      windowStart: locked || !firstFailure ? new Date().toISOString() : firstFailure,
      count: failures,
    },
    (entry) => `${entry.bucket}:${entry.subject}`,
  )
  return { locked, remaining: Math.max(0, MAX_FAILED_ATTEMPTS - failures) }
}

/** A correct code or PIN starts the count over. */
function clearFailures(bucket: AttemptBucket, deviceUid: string) {
  rateTable.remove((entry) => entry.bucket === bucket && entry.subject === deviceUid)
}

/** A centre tablet seats one explorer at a time: joining ends every other member's session. */
function takeCenterSeat(deviceUid: string, explorerId: string) {
  if (!isCenterDevice(deviceUid)) return
  for (const other of linkedIds(deviceUid)) {
    if (other === explorerId) continue
    devicesTable.remove((row) => row.explorerId === other && row.deviceUid === deviceUid)
    forgetCode(other)
  }
}

async function setCode(explorerId: string) {
  const code = generateRestoreCode()
  secretsTable.upsert(
    { explorerId, restoreCodeHash: await hashRestoreCode(code) },
    (row) => row.explorerId,
  )
  rememberCode(explorerId, code)
  return code
}

export function createMockExplorerService(): ExplorerService {
  return {
    async register({ nickname, avatar }) {
      await mockGate('explorer.register')
      const deviceUid = ensureDeviceUid()
      const problem = checkNickname(nickname)
      if (problem) throw new AppError('validation', NICKNAME_MESSAGES[problem], { problem })
      assertCanLinkMore(deviceUid)
      const now = new Date().toISOString()
      const explorer: Explorer = {
        id: crypto.randomUUID(),
        nickname: formatNickname(cleanNickname(nickname)),
        avatar,
        displayCode: generateDisplayCode(),
        settings: DEFAULT_EXPLORER_SETTINGS,
        createdVia: isCenterDevice(deviceUid) ? 'center' : 'self',
        createdAt: now,
        lastSeenAt: now,
      }
      explorersTable.insert(explorer)
      link(explorer.id, deviceUid)
      takeCenterSeat(deviceUid, explorer.id)
      const restoreCode = await setCode(explorer.id)
      return { explorer, restoreCode }
    },

    async restore(input) {
      await mockGate('explorer.restore')
      const deviceUid = ensureDeviceUid()
      assertNotLocked('restore', deviceUid, RESTORE_LOCKED)
      const code = normalizeRestoreCode(input)
      const hash = code ? await hashRestoreCode(code) : null
      const secret = hash ? secretsTable.find((row) => row.restoreCodeHash === hash) : undefined
      const explorer = secret
        ? explorersTable.find((row) => row.id === secret.explorerId)
        : undefined
      if (!code || !explorer) {
        const { locked, remaining } = recordFailure('restore', deviceUid)
        throw new AppError(
          locked ? 'rate_limited' : 'not_found',
          locked ? RESTORE_LOCKED : 'Bu Kâşif kodu bulunamadı. Kartındaki kodu kontrol et.',
          { remaining },
        )
      }
      clearFailures('restore', deviceUid)
      assertCanLinkMore(deviceUid, explorer.id)
      link(explorer.id, deviceUid)
      takeCenterSeat(deviceUid, explorer.id)
      rememberCode(explorer.id, code)
      const updated =
        explorersTable.update(
          (row) => row.id === explorer.id,
          (row) => ({ ...row, lastSeenAt: new Date().toISOString() }),
        )[0] ?? explorer
      return { explorer: updated, restoreCode: code }
    },

    async listOnDevice() {
      await mockGate('explorer.listOnDevice')
      const deviceUid = deviceSession.get()?.deviceUid
      if (!deviceUid) return []
      const ids = linkedIds(deviceUid)
      return explorersTable.filter((row) => ids.has(row.id))
    },

    async update(explorerId, patch) {
      await mockGate('explorer.update')
      const { explorer } = requireLinked(explorerId)
      if (patch.nickname !== undefined) {
        const problem = checkNickname(patch.nickname)
        if (problem) throw new AppError('validation', NICKNAME_MESSAGES[problem], { problem })
      }
      const next: Explorer = {
        ...explorer,
        ...(patch.nickname !== undefined
          ? { nickname: formatNickname(cleanNickname(patch.nickname)) }
          : {}),
        ...(patch.avatar ? { avatar: patch.avatar } : {}),
        ...(patch.settings ? { settings: patch.settings } : {}),
        lastSeenAt: new Date().toISOString(),
      }
      explorersTable.update(
        (row) => row.id === explorerId,
        () => next,
      )
      return next
    },

    async renewCode(explorerId) {
      await mockGate('explorer.renewCode')
      requireLinked(explorerId)
      return { restoreCode: await setCode(explorerId) }
    },

    async unlink(explorerId) {
      await mockGate('explorer.unlink')
      const deviceUid = requireDevice()
      devicesTable.remove((row) => row.explorerId === explorerId && row.deviceUid === deviceUid)
      forgetCode(explorerId)
    },

    async unlinkAll() {
      await mockGate('explorer.unlinkAll')
      const deviceUid = requireDevice()
      devicesTable.remove((row) => row.deviceUid === deviceUid)
      forgetAllCodes()
    },

    async deleteMembership(explorerId) {
      await mockGate('explorer.deleteMembership')
      requireLinked(explorerId)
      eventsTable.remove((row) => row.event.explorerId === explorerId)
      progressTable.remove((row) => row.explorerId === explorerId)
      badgesTable.remove((row) => row.explorerId === explorerId)
      devicesTable.remove((row) => row.explorerId === explorerId)
      secretsTable.remove((row) => row.explorerId === explorerId)
      explorersTable.remove((row) => row.id === explorerId)
      forgetCode(explorerId)
      appendAudit({
        actorId: null,
        action: 'explorer.self_deleted',
        entity: 'explorer',
        entityId: explorerId,
      })
    },

    async activateCenterDevice(setupCode) {
      await mockGate('explorer.activateCenterDevice')
      const deviceUid = ensureDeviceUid()
      assertNotLocked('center-setup', deviceUid, SETUP_LOCKED)
      const code = setupCode.toUpperCase().replace(/[\s-]/g, '')
      const hash = await hashRestoreCode(`center:${code}`)
      const device = centerTable.find(
        (row) =>
          row.setupCodeHash === hash &&
          row.revokedAt === null &&
          row.setupExpiresAt !== null &&
          Date.parse(row.setupExpiresAt) > Date.now(),
      )
      if (!device) {
        const { locked, remaining } = recordFailure('center-setup', deviceUid)
        throw new AppError(
          locked ? 'rate_limited' : 'not_found',
          locked ? SETUP_LOCKED : 'Kurulum kodu geçersiz ya da süresi dolmuş.',
          { remaining },
        )
      }
      clearFailures('center-setup', deviceUid)
      centerTable.update(
        (row) => row.id === device.id,
        (row) => ({
          ...row,
          deviceUid,
          activatedAt: new Date().toISOString(),
          setupCodeHash: null,
          setupExpiresAt: null,
        }),
      )
      centerDevice.set({ id: device.id, label: device.label })
      appendAudit({
        actorId: null,
        action: 'center_device.activated',
        entity: 'center_device',
        entityId: device.id,
      })
      return { id: device.id, label: device.label }
    },

    async exitCenterMode(pin) {
      await mockGate('explorer.exitCenterMode')
      const deviceUid = requireDevice()
      const device = centerTable.find(
        (row) => row.deviceUid === deviceUid && row.revokedAt === null,
      )
      const local = centerDevice.get()
      if (!device) {
        centerDevice.clear()
        return
      }
      assertNotLocked('center-pin', deviceUid, PIN_LOCKED)
      if (device.pinHash !== (await hashCenterPin(device.id, pin))) {
        const { locked, remaining } = recordFailure('center-pin', deviceUid)
        throw new AppError(
          locked ? 'rate_limited' : 'forbidden',
          locked ? PIN_LOCKED : 'PIN yanlış.',
          { remaining },
        )
      }
      clearFailures('center-pin', deviceUid)
      centerTable.update(
        (row) => row.id === device.id,
        (row) => ({ ...row, deviceUid: null }),
      )
      if (local) centerDevice.clear()
      appendAudit({
        actorId: null,
        action: 'center_device.exited',
        entity: 'center_device',
        entityId: device.id,
      })
    },
  }
}
