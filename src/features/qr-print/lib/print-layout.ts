import { z } from 'zod'

import { qrPrefixSchema } from '@/entities/kit'

export const PRINT_TEMPLATE_IDS = ['card', 'label', 'box'] as const
/** Validates the template id, e.g. from a `?sablon=` URL parameter. */
export const printTemplateSchema = z.enum(PRINT_TEMPLATE_IDS)
export type PrintTemplate = z.infer<typeof printTemplateSchema>

/** Name and help text of each printable template (Studio template picker). */
export const PRINT_TEMPLATES = {
  card: {
    label: 'Kart',
    description:
      'Kartvizit boyutunda (85 × 55 mm) kartlar. A4 sayfaya 2 × 5 kart sığar; kesik çizgilerden kesin.',
  },
  label: {
    label: 'Ekipman etiketi',
    description:
      '40, 50 ya da 70 mm kare etiketler. Sütun, satır, kenar boşluğu ve aralığı etiket kâğıdınıza göre ayarlayın.',
  },
  box: {
    label: 'Kit kutusu',
    description:
      'A6 kutu etiketi: kit adı, kit QR kodu, kullanım adımları ve kart kodları. A4 sayfaya 4 etiket basılır.',
  },
} as const satisfies Record<PrintTemplate, { label: string; description: string }>

export const LABEL_SIZES_MM = [40, 50, 70] as const
export type LabelSizeMm = (typeof LABEL_SIZES_MM)[number]

export const A4_MM = { width: 210, height: 297 } as const
/** Business-card grid: 2 × 5 cards of 85 × 55 mm, centred on A4. */
export const CARD_GRID = { columns: 2, rows: 5, width: 85, height: 55 } as const
/** Kit-box labels: 2 × 2 A6 (105 × 148 mm) on A4. */
export const BOX_GRID = { columns: 2, rows: 2, width: 105, height: 148 } as const
export const LABEL_DEFAULTS = { sizeMm: 50, marginMm: 10, gapMm: 5 } as const

/** Splits `items` into pages of `perPage` (at least 1). */
export function paginate<T>(items: readonly T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage))
  const pages: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    pages.push(items.slice(start, start + size))
  }
  return pages
}

/** How many square labels fit across and down an A4 sheet. */
export function fitLabelGrid(sizeMm: number, marginMm: number, gapMm: number) {
  const fit = (length: number) =>
    Math.max(1, Math.floor((length - 2 * marginMm + gapMm) / (sizeMm + gapMm)))
  return { columns: fit(A4_MM.width), rows: fit(A4_MM.height) }
}

/** Whether a label grid (margin on every side) fits on A4. */
export function labelGridFits({
  sizeMm,
  columns,
  rows,
  marginMm,
  gapMm,
}: {
  sizeMm: number
  columns: number
  rows: number
  marginMm: number
  gapMm: number
}) {
  const span = (count: number) => 2 * marginMm + count * sizeMm + (count - 1) * gapMm
  const tolerance = 0.01
  return span(columns) <= A4_MM.width + tolerance && span(rows) <= A4_MM.height + tolerance
}

/** A physical position on a sheet (`slot` = 0-based reading order) and what is printed there. */
export type SheetSlot<T> = { slot: number; item: T | null }

/**
 * Back side for duplex printing (flip on the long edge): every row is mirrored, so the back of
 * the card in column 1 lands behind it. Missing cells in a short last row stay empty.
 */
export function mirrorRows<T>(items: readonly T[], columns: number): SheetSlot<T>[] {
  const width = Math.max(1, Math.floor(columns))
  const cells: (T | null)[] = []
  for (let start = 0; start < items.length; start += width) {
    const row: (T | null)[] = items.slice(start, start + width)
    while (row.length < width) row.push(null)
    cells.push(...row.toReversed())
  }
  return cells.map((item, slot) => ({ slot, item }))
}

/** Kit codes have no card number: `KC` (kit) vs `KC-01` (card). */
export function isKitCode(code: string) {
  return qrPrefixSchema.safeParse(code).success
}

/**
 * The kit's own label (falls back to the first one) and the card labels, for the box template.
 */
export function splitKitLabel<T extends { code: string }>(labels: readonly T[]) {
  const kit = labels.find((label) => isKitCode(label.code)) ?? labels[0]
  return { kit, cards: labels.filter((label) => label !== kit) }
}

/** Positive whole number within `[1, max]`, or `undefined` for missing/invalid input. */
export function toCount(value: number | undefined, max: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  const count = Math.floor(value)
  return count >= 1 ? Math.min(count, max) : undefined
}

/** Non-negative length in mm within `[0, max]`, or `undefined` for missing/invalid input. */
export function toLength(value: number | undefined, max: number) {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined
  return Math.min(value, max)
}
