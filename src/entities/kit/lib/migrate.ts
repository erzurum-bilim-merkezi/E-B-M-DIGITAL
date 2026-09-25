import { KIT_SCHEMA_VERSION, kitDocumentSchema, type KitDocument } from '../model/kit.ts'

export class KitMigrationError extends Error {
  readonly reason: 'newer' | 'unknown' | 'invalid'

  constructor(reason: 'newer' | 'unknown' | 'invalid', message: string) {
    super(message)
    this.name = 'KitMigrationError'
    this.reason = reason
  }
}

function readVersion(raw: unknown) {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) return undefined
  const { schemaVersion } = raw
  return typeof schemaVersion === 'number' ? schemaVersion : undefined
}

/**
 * Upgrades any stored kit document to the current schema. Snapshots in the CDN and service
 * worker caches can be months old, so every reader goes through here.
 */
export function migrateKit(raw: unknown): KitDocument {
  const version = readVersion(raw)
  if (version === undefined) {
    throw new KitMigrationError('unknown', 'Bu dosya bir Kâşif Kiti değil (schemaVersion yok).')
  }
  if (version > KIT_SCHEMA_VERSION) {
    throw new KitMigrationError(
      'newer',
      `Bu kit daha yeni bir sürümle hazırlanmış (şema ${version}). Uygulamayı güncelleyin.`,
    )
  }
  // Only v1 exists; future upgrades chain here (v1 → v2 → …) before parsing.
  const result = kitDocumentSchema.safeParse(raw)
  if (!result.success) {
    throw new KitMigrationError('invalid', 'Kit dosyası bozuk ya da eksik.')
  }
  return result.data
}
