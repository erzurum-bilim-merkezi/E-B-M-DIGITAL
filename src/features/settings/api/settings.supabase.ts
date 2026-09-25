import { z } from 'zod'

import { appSettingsSchema, auditEntrySchema, centerDeviceSchema } from '@/entities/studio'
import { staffClient, unwrap } from '@/shared/api/supabase'

import type { SettingsService } from './settings'

/*
 * Settings on Supabase: the app_settings document, centre tablets (their PIN and setup-code hashes
 * are not readable), the audit trail and AI usage — admin-only where the mock says so.
 */

const summarySchema = centerDeviceSchema.omit({ pinHash: true, setupCodeHash: true })
const DEVICE_COLUMNS =
  'id, label, setupExpiresAt:setup_expires_at, deviceUid:device_uid, activatedAt:activated_at, revokedAt:revoked_at, createdBy:created_by, createdAt:created_at'
const AUDIT_COLUMNS = 'id, actorId:actor_id, action, entity, entityId:entity_id, meta, at'

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return unwrap(await staffClient().rpc(name, args))
}

export function createSupabaseSettingsService(): SettingsService {
  return {
    async get() {
      const row = unwrap(await staffClient().from('app_settings').select('value').single())
      return appSettingsSchema.parse(z.object({ value: z.unknown() }).parse(row).value)
    },
    async update(patch) {
      return appSettingsSchema.parse(await rpc('settings_update', { p_patch: patch }))
    },
    async listCenterDevices() {
      const rows = unwrap(
        await staffClient()
          .from('center_devices')
          .select(DEVICE_COLUMNS)
          .order('created_at', { ascending: false }),
      )
      return z.array(summarySchema).parse(rows)
    },
    async createCenterDevice({ label, pin }) {
      return z
        .object({ device: summarySchema, setupCode: z.string() })
        .parse(await rpc('center_device_create', { p_label: label, p_pin: pin }))
    },
    async revokeCenterDevice(id) {
      await rpc('center_device_revoke', { p_device: id })
    },
    async auditLog(limit = 50) {
      const rows = unwrap(
        await staffClient()
          .from('audit_log')
          .select(AUDIT_COLUMNS)
          .order('at', { ascending: false })
          .limit(limit),
      )
      return z.array(auditEntrySchema).parse(rows)
    },
    async aiUsage() {
      return z
        .array(z.object({ day: z.string(), count: z.int() }))
        .parse(await rpc('ai_usage_daily'))
    },
  }
}
