import { z } from 'zod'

/** Staff (Kâşif Studio users). Registration is closed; admins create accounts. */
export const STAFF_ROLES = ['admin', 'editor'] as const
export const staffRoleSchema = z.enum(STAFF_ROLES)
export type StaffRole = z.infer<typeof staffRoleSchema>

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Yönetici',
  editor: 'Editör',
}

export const staffUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().min(2).max(60),
  role: staffRoleSchema,
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  totpEnrolled: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  lastSignInAt: z.iso.datetime({ offset: true }).nullable(),
})
export type StaffUser = z.infer<typeof staffUserSchema>

/** Admin accounts must use two-factor authentication; at least two are needed to go live. */
export const MIN_ACTIVE_ADMINS = 2

export const PASSWORD_MIN_LENGTH = 10

export type PasswordProblem = 'length' | 'letters' | 'digits' | 'common'
const COMMON = ['password', 'parola', '12345678', 'qwerty', 'kasif', 'erzurum', 'admin']

/** Strong-password policy (Free plan has no leaked-password protection). */
export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'length'
  if (!/[a-zçğıöşü]/i.test(password)) return 'letters'
  if (!/\d/.test(password)) return 'digits'
  const lower = password.toLocaleLowerCase('tr')
  if (COMMON.some((word) => lower.includes(word)) && password.length < 16) return 'common'
  return null
}

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  length: `Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`,
  letters: 'Parola en az bir harf içermeli.',
  digits: 'Parola en az bir rakam içermeli.',
  common: 'Bu parola kolay tahmin edilir. Daha özgün bir parola seçin.',
}

/** Uploaded media metadata (`media_assets`). Video is never uploaded — only linked. */
export const MEDIA_KINDS = ['image', 'audio', 'captions', 'ai-scene', 'ai-icon', 'icon'] as const
export const mediaKindSchema = z.enum(MEDIA_KINDS)
export type MediaKind = z.infer<typeof mediaKindSchema>

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: 'Görsel',
  audio: 'Ses',
  captions: 'Altyazı',
  'ai-scene': 'Yapay zekâ sahnesi',
  'ai-icon': 'Yapay zekâ ikonu',
  icon: 'İkon',
}

export const mediaAssetSchema = z.object({
  id: z.uuid(),
  kind: mediaKindSchema,
  name: z.string().max(120),
  mime: z.string().max(80),
  bytes: z.int().nonnegative(),
  width: z.int().nullable(),
  height: z.int().nullable(),
  durationSec: z.number().nullable(),
  /** Required for images (WCAG 1.1.1); AI scenes take it from the SVG <desc>. */
  alt: z.string().max(240),
  /** `https://…` (Supabase Storage) or `mock-media:<id>` (mock backend). */
  url: z.string().max(2048),
  source: z.enum(['upload', 'ai']),
  /** Groups the per-state SVG files of one AI scene. */
  sceneGroup: z.uuid().nullable(),
  sceneState: z.string().max(24).nullable(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
})
export type MediaAsset = z.infer<typeof mediaAssetSchema>

/** Admin-editable platform settings (`app_settings`). */
export const appSettingsSchema = z.object({
  aiProvider: z.enum(['gemini', 'fake', 'off']),
  aiDailyProjectLimit: z.int().min(0).max(10_000),
  aiDailyUserLimit: z.int().min(0).max(500),
  aiSuggestionCount: z.int().min(1).max(3),
  rawEventRetentionDays: z.int().min(7).max(60),
  inactiveExplorerMonths: z.int().min(3).max(24),
  /** Future option: require an educator confirmation step on the welcome screen (KVKK). */
  educatorConsentStep: z.boolean(),
})
export type AppSettings = z.infer<typeof appSettingsSchema>

export const DEFAULT_APP_SETTINGS: AppSettings = {
  aiProvider: 'fake',
  aiDailyProjectLimit: 200,
  aiDailyUserLimit: 20,
  aiSuggestionCount: 1,
  rawEventRetentionDays: 60,
  inactiveExplorerMonths: 12,
  educatorConsentStep: false,
}

/** Shared centre tablets (kiosk mode). Setup codes are single use and expire after 24 h. */
export const centerDeviceSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(60),
  setupCodeHash: z.string().nullable(),
  setupExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  pinHash: z.string(),
  deviceUid: z.string().nullable(),
  activatedAt: z.iso.datetime({ offset: true }).nullable(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
})
export type CenterDevice = z.infer<typeof centerDeviceSchema>

export const CENTER_SETUP_TTL_MS = 24 * 60 * 60 * 1000

export const auditEntrySchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  action: z.string().max(60),
  entity: z.string().max(40),
  entityId: z.string().max(80).nullable(),
  meta: z.record(z.string(), z.unknown()),
  at: z.iso.datetime({ offset: true }),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>
