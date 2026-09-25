import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { generateSetupCode, hashCenterPin, hashRestoreCode } from '@/entities/explorer'
import {
  appSettingsSchema,
  auditEntrySchema,
  CENTER_SETUP_TTL_MS,
  centerDeviceSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AuditEntry,
  type CenterDevice,
} from '@/entities/studio'
import { AppError } from '@/shared/api/errors'
import { appendAudit } from '@/shared/api/mock-audit'
import { requireStaff } from '@/shared/api/mock-auth'
import { mockDoc, mockGate, mockTable } from '@/shared/api/mock-db'
import { MOCK_DOCS, MOCK_TABLES } from '@/shared/api/mock-tables'
import { STUDIO_QUERY_ROOT } from '@/shared/api/query-keys'
import { isSupabaseBackend } from '@/shared/config/backend'
import { istanbulDayKey, lastDayKeys } from '@/shared/lib/format'

import { createSupabaseSettingsService } from './settings.supabase'

/** What Studio sees of a centre device — never the PIN or setup-code hashes. */
export type CenterDeviceSummary = Omit<CenterDevice, 'pinHash' | 'setupCodeHash'>

export type SettingsService = {
  get(): Promise<AppSettings>
  update(patch: Partial<AppSettings>): Promise<AppSettings>
  listCenterDevices(): Promise<CenterDeviceSummary[]>
  createCenterDevice(input: {
    label: string
    pin: string
  }): Promise<{ device: CenterDeviceSummary; setupCode: string }>
  revokeCenterDevice(id: string): Promise<void>
  auditLog(limit?: number): Promise<AuditEntry[]>
  aiUsage(): Promise<{ day: string; count: number }[]>
}

const settingsDoc = mockDoc(MOCK_DOCS.settings, appSettingsSchema)
const centerTable = mockTable(MOCK_TABLES.centerDevices, centerDeviceSchema)
const auditTable = mockTable(MOCK_TABLES.auditLog, auditEntrySchema)
const usageTable = mockTable(
  MOCK_TABLES.aiUsage,
  z.object({
    id: z.uuid(),
    userId: z.uuid(),
    kind: z.string(),
    status: z.string(),
    model: z.string(),
    createdAt: z.string(),
  }),
)

function toSummary({
  pinHash: _pinHash,
  setupCodeHash: _setupCodeHash,
  ...summary
}: CenterDevice): CenterDeviceSummary {
  return summary
}

function createMockSettingsService(): SettingsService {
  return {
    async get() {
      await mockGate('settings.get')
      requireStaff()
      return settingsDoc.get() ?? DEFAULT_APP_SETTINGS
    },
    async update(patch) {
      await mockGate('settings.update')
      const caller = requireStaff({ role: 'admin' })
      const next = appSettingsSchema.safeParse({
        ...(settingsDoc.get() ?? DEFAULT_APP_SETTINGS),
        ...patch,
      })
      if (!next.success)
        throw new AppError('validation', 'Ayar değerleri izin verilen aralığın dışında.')
      settingsDoc.set(next.data)
      appendAudit({
        actorId: caller.userId,
        action: 'settings.updated',
        entity: 'settings',
        entityId: null,
        meta: { keys: Object.keys(patch) },
      })
      return next.data
    },
    async listCenterDevices() {
      await mockGate('settings.listCenterDevices')
      requireStaff({ role: 'admin' })
      return centerTable
        .all()
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toSummary)
    },
    async createCenterDevice({ label, pin }) {
      await mockGate('settings.createCenterDevice')
      const caller = requireStaff({ role: 'admin' })
      if (!label.trim())
        throw new AppError('validation', 'Cihaza bir ad verin (ör. “Giriş tableti 1”).')
      if (!/^\d{4,8}$/.test(pin)) throw new AppError('validation', 'PIN 4–8 rakam olmalı.')
      const setupCode = generateSetupCode()
      const id = crypto.randomUUID()
      const device: CenterDevice = {
        id,
        label: label.trim().slice(0, 60),
        setupCodeHash: await hashRestoreCode(`center:${setupCode}`),
        setupExpiresAt: new Date(Date.now() + CENTER_SETUP_TTL_MS).toISOString(),
        pinHash: await hashCenterPin(id, pin),
        deviceUid: null,
        activatedAt: null,
        revokedAt: null,
        createdBy: caller.userId,
        createdAt: new Date().toISOString(),
      }
      centerTable.insert(device)
      appendAudit({
        actorId: caller.userId,
        action: 'center_device.created',
        entity: 'center_device',
        entityId: device.id,
      })
      return { device: toSummary(device), setupCode }
    },
    async revokeCenterDevice(id) {
      await mockGate('settings.revokeCenterDevice')
      const caller = requireStaff({ role: 'admin' })
      centerTable.update(
        (row) => row.id === id,
        (row) => ({ ...row, revokedAt: new Date().toISOString(), setupCodeHash: null }),
      )
      appendAudit({
        actorId: caller.userId,
        action: 'center_device.revoked',
        entity: 'center_device',
        entityId: id,
      })
    },
    async auditLog(limit = 50) {
      await mockGate('settings.auditLog')
      requireStaff({ role: 'admin' })
      return auditTable
        .all()
        .toSorted((a, b) => b.at.localeCompare(a.at))
        .slice(0, limit)
    },
    async aiUsage() {
      await mockGate('settings.aiUsage')
      requireStaff({ role: 'admin' })
      const rows = usageTable.filter((row) => row.status === 'ok')
      return lastDayKeys(14).map((day) => ({
        day,
        count: rows.filter((row) => istanbulDayKey(row.createdAt) === day).length,
      }))
    },
  }
}

export const settingsService: SettingsService = isSupabaseBackend
  ? createSupabaseSettingsService()
  : createMockSettingsService()

export const settingsKeys = {
  all: [STUDIO_QUERY_ROOT, 'settings'] as const,
  settings: () => [...settingsKeys.all, 'app'] as const,
  centerDevices: () => [...settingsKeys.all, 'center-devices'] as const,
  audit: () => [...settingsKeys.all, 'audit'] as const,
  aiUsage: () => [...settingsKeys.all, 'ai-usage'] as const,
}

export const appSettingsQueryOptions = () =>
  queryOptions({ queryKey: settingsKeys.settings(), queryFn: () => settingsService.get() })
export const centerDevicesQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.centerDevices(),
    queryFn: () => settingsService.listCenterDevices(),
  })
export const auditLogQueryOptions = () =>
  queryOptions({ queryKey: settingsKeys.audit(), queryFn: () => settingsService.auditLog() })
export const aiUsageQueryOptions = () =>
  queryOptions({ queryKey: settingsKeys.aiUsage(), queryFn: () => settingsService.aiUsage() })

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => settingsService.update(patch),
    // AI provider and quotas influence Studio-wide UI (AI buttons appear/disappear).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDIO_QUERY_ROOT] }),
  })
}

export function useCreateCenterDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { label: string; pin: string }) =>
      settingsService.createCenterDevice(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}

export function useRevokeCenterDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => settingsService.revokeCenterDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}
