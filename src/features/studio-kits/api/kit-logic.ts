import {
  formatCardCode,
  latestVersionOf,
  slugifyTr,
  uniqueSlug,
  type KitDocument,
  type KitVersion,
  type QrCodeRow,
  type StudioKit,
} from '@/entities/kit'
import { AppError } from '@/shared/api/errors'

import type { KitQrCode } from './port'

/*
 * Kit rules both adapters share (mock and Supabase), so they cannot drift apart. Pure functions:
 * the adapters bring the rows.
 */

/** The document with a new QR prefix: card codes keep their numbers (KC-03 → BK-03). */
export function withPrefix(document: KitDocument, qrPrefix: string): KitDocument {
  return {
    ...document,
    qrPrefix,
    steps: document.steps.map((step) => ({
      ...step,
      qrCode: formatCardCode(qrPrefix, Number(step.qrCode.split('-')[1] ?? '0')),
    })),
  }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Address and prefix of a copy: "<slug>-kopya(-N)" and the first free prefix like the source. */
export function duplicateIdentity(
  source: Pick<StudioKit, 'slug' | 'qrPrefix'>,
  takenSlugs: ReadonlySet<string>,
  takenPrefixes: ReadonlySet<string>,
) {
  // Room for "-kopya" and a "-N" counter within the 60-character limit, never a trailing dash.
  const slug = uniqueSlug(`${slugifyTr(source.slug, 44)}-kopya`, new Set(takenSlugs), 'kopya')
  let qrPrefix = source.qrPrefix
  for (let i = 0; takenPrefixes.has(qrPrefix) && i < LETTERS.length * LETTERS.length; i++) {
    const base = source.qrPrefix.slice(0, 2)
    qrPrefix = `${base}${LETTERS[i % LETTERS.length] ?? 'X'}${i >= LETTERS.length ? (LETTERS[Math.floor(i / LETTERS.length)] ?? '') : ''}`
  }
  if (takenPrefixes.has(qrPrefix)) {
    throw new AppError('conflict', 'Kopya için boş bir QR öneki bulunamadı.')
  }
  return { slug, qrPrefix }
}

/** The copy's draft: new identity, "(kopya)" title, version 0. */
export function duplicateDraft(
  source: StudioKit,
  identity: { id: string; slug: string; qrPrefix: string },
): KitDocument {
  return withPrefix(
    {
      ...structuredClone(source.draft),
      id: identity.id,
      slug: identity.slug,
      title: `${source.draft.title} (kopya)`.slice(0, 60),
      version: 0,
    },
    identity.qrPrefix,
  )
}

/**
 * Every code a kit has (kit code first, then its cards in order, then codes of deleted cards)
 * with its state: live (in the published version of a live kit), pending (will go live with
 * the next publish) or retired (never printed again).
 */
export function kitQrCodes(
  kit: StudioKit,
  versions: readonly KitVersion[],
  qrRows: readonly QrCodeRow[],
): KitQrCode[] {
  const latest = latestVersionOf(kit.id, versions)
  const liveCodes = new Set<string>(
    latest ? [latest.document.qrPrefix, ...latest.document.steps.map((step) => step.qrCode)] : [],
  )
  const live = kit.status !== 'archived'
  const draftCodes = new Set(kit.draft.steps.map((step) => step.qrCode))
  const codes: KitQrCode[] = [
    {
      code: kit.qrPrefix,
      stepId: null,
      title: kit.draft.title,
      icon: kit.draft.icon,
      cardNumber: null,
      state: live && liveCodes.has(kit.qrPrefix) ? 'live' : 'pending',
    },
    ...kit.draft.steps.map((step, index) => ({
      code: step.qrCode,
      stepId: step.id,
      title: step.title,
      icon: step.icon,
      cardNumber: index + 1,
      state: (live && liveCodes.has(step.qrCode) ? 'live' : 'pending') as KitQrCode['state'],
    })),
  ]
  for (const row of qrRows) {
    if (row.kitId !== kit.id || row.stepId === null || draftCodes.has(row.code)) continue
    // A card deleted only in the draft stays in the published qr-index until the next
    // publish; its code is retired only once it is in neither the published version nor
    // the draft.
    const published = liveCodes.has(row.code)
    codes.push({
      code: row.code,
      stepId: row.stepId,
      title: 'Silinmiş kart',
      icon: { kind: 'emoji', value: '🗑️' },
      cardNumber: null,
      state: published ? (live ? 'live' : 'pending') : 'retired',
    })
  }
  return codes
}
