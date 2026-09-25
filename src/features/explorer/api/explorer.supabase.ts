import { z } from 'zod'

import {
  cleanNickname,
  explorerSchema,
  formatNickname,
  normalizeRestoreCode,
  type Explorer,
} from '@/entities/explorer'
import {
  currentDeviceId,
  ensureDeviceSession,
  kidsClient,
  toAppError,
  unwrap,
  unwrapResult,
} from '@/shared/api/supabase'

import { centerDevice, forgetAllCodes, forgetCode, rememberCode } from './device'
import type { ExplorerService } from './port'

/*
 * Kâşif membership on Supabase (ADR 0009, 0017). The device signs in anonymously once; the
 * register/restore/… RPCs link members to that device. The device keeps only which member is
 * active and the codes it was shown (./device.ts), exactly like the mock adapter.
 */

const withCodeSchema = z.object({ explorer: explorerSchema, restoreCode: z.string() })
const centerSchema = z.object({ id: z.uuid(), label: z.string() })

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  await ensureDeviceSession().catch((error: unknown) => {
    throw toAppError(error)
  })
  return unwrap(await kidsClient().rpc(name, args))
}

/** Nicknames are stored like the mock does: spaces collapsed, words capitalised (Turkish). */
function nickname(value: string) {
  return formatNickname(cleanNickname(value))
}

/**
 * Keeps the code of a member who just joined this device. A centre tablet seats one member at a
 * time (the server has ended the other seats): the previous child's code must not stay behind.
 */
function rememberJoined(explorerId: string, code: string) {
  if (centerDevice.get()) forgetAllCodes()
  rememberCode(explorerId, code)
}

export function createSupabaseExplorerService(): ExplorerService {
  return {
    async register({ nickname: name, avatar }) {
      const result = withCodeSchema.parse(
        await call('register_explorer', { p_nickname: nickname(name), p_avatar: avatar }),
      )
      rememberJoined(result.explorer.id, result.restoreCode)
      return result
    },

    async restore(input) {
      const code = normalizeRestoreCode(input)
      // A malformed code still counts as a failed attempt on the server (same as the mock).
      const result = withCodeSchema.parse(
        unwrapResult(await call('restore_explorer', { p_code: code ?? input.slice(0, 32) })),
      )
      rememberJoined(result.explorer.id, result.restoreCode)
      return result
    },

    async listOnDevice() {
      // No device session yet means no members — never create one just to read.
      if (!(await currentDeviceId())) return []
      const rows = unwrap(
        await kidsClient()
          .from('explorers')
          .select(
            'id, nickname, avatar, displayCode:display_code, settings, createdVia:created_via, createdAt:created_at, lastSeenAt:last_seen_at',
          )
          .order('created_at'),
      )
      return z.array(explorerSchema).parse(rows)
    },

    async update(explorerId, patch) {
      const updated: Explorer = explorerSchema.parse(
        await call('update_explorer', {
          p_explorer: explorerId,
          p_nickname: patch.nickname === undefined ? null : nickname(patch.nickname),
          p_avatar: patch.avatar ?? null,
          p_settings: patch.settings ?? null,
        }),
      )
      return updated
    },

    async renewCode(explorerId) {
      const restoreCode = z
        .string()
        .parse(await call('renew_restore_code', { p_explorer: explorerId }))
      rememberCode(explorerId, restoreCode)
      return { restoreCode }
    },

    async unlink(explorerId) {
      await call('unlink_explorer', { p_explorer: explorerId })
      forgetCode(explorerId)
    },

    async unlinkAll() {
      await call('unlink_all_explorers')
      forgetAllCodes()
    },

    async deleteMembership(explorerId) {
      await call('delete_membership', { p_explorer: explorerId })
      forgetCode(explorerId)
    },

    async activateCenterDevice(setupCode) {
      const result = unwrapResult(await call('activate_center_device', { p_code: setupCode }))
      const device = centerSchema.parse(result['device'])
      centerDevice.set(device)
      return device
    },

    async exitCenterMode(pin) {
      unwrapResult(await call('exit_center_mode', { p_pin: pin }))
      centerDevice.clear()
    },
  }
}
