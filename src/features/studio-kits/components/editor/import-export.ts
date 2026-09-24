import { formatCardCode, KitMigrationError, migrateKit, type KitDocument } from '@/entities/kit'

export type ImportResult = { ok: true; document: KitDocument } | { ok: false; message: string }

/**
 * JSON import into an existing kit (F8.10): contents are replaced, identity is kept — id, slug
 * and QR prefix stay; card codes are renumbered after the kit's counter so no printed code is
 * ever reused.
 */
export function importKitJson(text: string, target: KitDocument): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, message: 'Dosya okunamadı: geçerli bir JSON değil.' }
  }
  let imported: KitDocument
  try {
    imported = migrateKit(raw)
  } catch (error) {
    return {
      ok: false,
      message: error instanceof KitMigrationError ? error.message : 'Kit dosyası geçersiz.',
    }
  }
  let sequence = Math.max(target.qrSequence, 0)
  const existingCodes = new Map(target.steps.map((step) => [step.id, step.qrCode]))
  const steps = imported.steps.map((step) => {
    const kept = existingCodes.get(step.id)
    if (kept) return { ...step, qrCode: kept }
    sequence += 1
    return { ...step, qrCode: formatCardCode(target.qrPrefix, sequence) }
  })
  return {
    ok: true,
    document: {
      ...imported,
      id: target.id,
      slug: target.slug,
      qrPrefix: target.qrPrefix,
      version: 0,
      qrSequence: sequence,
      steps,
    },
  }
}

export function exportFileName(document: KitDocument) {
  return `${document.slug}-kasif-kiti.json`
}
