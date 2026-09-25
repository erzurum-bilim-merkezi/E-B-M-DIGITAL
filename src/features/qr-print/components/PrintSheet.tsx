import { ScanLine } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import type { KitDocument } from '@/entities/kit'

import { cn } from '@/shared/lib/cn'
import { Alert, EmptyState, QrCode } from '@/shared/ui'

import {
  BOX_GRID,
  CARD_GRID,
  fitLabelGrid,
  LABEL_DEFAULTS,
  LABEL_SIZES_MM,
  labelGridFits,
  mirrorRows,
  paginate,
  splitKitLabel,
  toCount,
  toLength,
  type LabelSizeMm,
  type PrintTemplate,
  type SheetSlot,
} from '../lib/print-layout'
import type { QrLabel } from '../lib/qr-image'

export type PrintLabel = QrLabel & { iconEmoji?: string }
type QrEntryMode = KitDocument['qrEntryMode']

export type PrintSheetProps = {
  template: PrintTemplate
  labels: readonly PrintLabel[]
  /** Label template: sticker size (default 50 mm). */
  labelSizeMm?: LabelSizeMm
  /** Label template: grid of the label paper. Defaults fill the A4 sheet. */
  columns?: number
  rows?: number
  /** Label template: sheet margin on every side and space between labels, in mm. */
  marginMm?: number
  gapMm?: number
  /** Card template: adds a mirrored back page for duplex printing. Box template: footnote. */
  backNote?: string
  kitTitle: string
  /** Box template: how children move through the kit after a scan. */
  entryMode?: QrEntryMode
  className?: string
}

/**
 * Print rules: A4 without browser margins, only the sheets are printed (everything else — the
 * Studio chrome, toasts — is hidden and the sheets' ancestors lose their layout constraints),
 * one sheet per page.
 */
const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: none !important; }
  body :not(:has(.qr-print-root)):not(.qr-print-root):not(.qr-print-root *) { display: none !important; }
  :has(.qr-print-root) {
    display: block !important; position: static !important; inset: auto !important;
    width: auto !important; min-width: 0 !important; max-width: none !important;
    height: auto !important; min-height: 0 !important; max-height: none !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: visible !important;
    transform: none !important; box-shadow: none !important; background: none !important;
  }
  .qr-print-root { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .qr-print-page { break-inside: avoid; }
  .qr-print-page:not(:last-child) { break-after: page; }
}
`

/** "Nasıl kullanılır?" on the box label follows the kit's QR entry mode. */
const BOX_STEPS: Record<QrEntryMode, readonly string[]> = {
  focused: ['Kâşif uygulamasını aç', "QR Okut'a dokun", "Her kartın QR'ını okut"],
  full: ['Kâşif uygulamasını aç', "QR Okut'a dokun", "Kit QR'ını okut, kartlarla sırayla ilerle"],
}
/** Codes listed on a box label before "+N kart daha" (keeps the A6 label from overflowing). */
const BOX_CARD_LIMIT = 16
const CUT_LINE = 'border-dashed border-border-strong'

type SheetPage = { key: string; back: boolean; content: ReactNode }

/** Every cell draws its right and bottom cut line, plus left/top on the outer edge of the grid. */
function cutEdges(index: number, columns: number) {
  return cn(
    'border-r border-b',
    CUT_LINE,
    index % columns === 0 && 'border-l',
    index < columns && 'border-t',
  )
}

// `leading-*` goes after the size: tailwind-merge drops a line height that precedes a font size.
function CodePill({ children, size }: { children: ReactNode; size: string }) {
  return (
    <span
      className={cn(
        'rounded-full border-[0.35mm] border-fg px-[0.6em] py-[0.18em] font-mono font-bold tracking-wide text-fg',
        size,
        'leading-none',
      )}
    >
      {children}
    </span>
  )
}

function ScanHint({ size }: { size: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-[0.4em] font-medium text-fg-muted',
        size,
        'leading-none',
      )}
    >
      <ScanLine aria-hidden="true" className="size-[1.3em]" />
      Kâşif ile okut
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// Card template — 85 × 55 mm, 2 × 5 on A4
// ---------------------------------------------------------------------------------------------

const CARD_GRID_CLASSES =
  'absolute top-[11mm] left-[20mm] grid grid-cols-[repeat(2,85mm)] auto-rows-[55mm]'

function CardFronts({ labels }: { labels: readonly PrintLabel[] }) {
  return (
    <ul className={CARD_GRID_CLASSES}>
      {labels.map((label, index) => (
        <li
          key={label.code}
          className={cn(
            'flex items-center gap-[3mm] p-[3.5mm]',
            cutEdges(index, CARD_GRID.columns),
          )}
        >
          <QrCode
            value={label.url}
            label={`${label.code} QR kodu`}
            quietZone={2}
            className="size-[38mm] shrink-0"
          />
          <div className="flex h-full min-w-0 flex-1 flex-col justify-between py-[0.5mm]">
            <div className="flex min-w-0 flex-col gap-[1.2mm]">
              <p className="flex items-center gap-[1.2mm] text-[8pt] leading-none font-semibold text-primary">
                {label.iconEmoji && (
                  <span aria-hidden="true" className="text-[12pt] leading-none">
                    {label.iconEmoji}
                  </span>
                )}
                <span className="truncate">{label.caption}</span>
              </p>
              <p className="line-clamp-3 text-[10pt] leading-[1.15] font-bold wrap-anywhere text-fg">
                {label.title}
              </p>
            </div>
            <div className="flex flex-col items-start gap-[1.4mm]">
              <CodePill size="text-[15pt]">{label.code}</CodePill>
              <ScanHint size="text-[6.5pt]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CardBacks({
  cells,
  note,
  kitTitle,
}: {
  cells: readonly SheetSlot<PrintLabel>[]
  note: string
  kitTitle: string
}) {
  return (
    <>
      <p className="sr-only">Kartların arka yüzü: {note}</p>
      <div aria-hidden="true" className={CARD_GRID_CLASSES}>
        {cells.map(({ slot, item }) =>
          item ? (
            <div
              key={slot}
              className="flex flex-col items-center justify-center gap-[1.5mm] p-[5mm] text-center"
            >
              <p className="text-[12pt] leading-none font-bold text-primary">Kâşif</p>
              <p className="line-clamp-1 text-[8.5pt] font-semibold wrap-anywhere text-fg">
                {kitTitle}
              </p>
              <p className="line-clamp-4 text-[8pt] leading-snug wrap-anywhere text-fg-muted">
                {note}
              </p>
            </div>
          ) : (
            <div key={slot} />
          ),
        )}
      </div>
    </>
  )
}

function cardPages(labels: readonly PrintLabel[], note: string | undefined, kitTitle: string) {
  const perPage = CARD_GRID.columns * CARD_GRID.rows
  return paginate(labels, perPage).flatMap((chunk, index): SheetPage[] => {
    const front: SheetPage = {
      key: `card-${index}`,
      back: false,
      content: <CardFronts labels={chunk} />,
    }
    if (!note) return [front]
    return [
      front,
      {
        key: `card-back-${index}`,
        back: true,
        content: (
          <CardBacks cells={mirrorRows(chunk, CARD_GRID.columns)} note={note} kitTitle={kitTitle} />
        ),
      },
    ]
  })
}

// ---------------------------------------------------------------------------------------------
// Label template — square equipment stickers
// ---------------------------------------------------------------------------------------------

const STICKER_STYLES: Record<
  LabelSizeMm,
  { cell: string; qr: string; code: string; title: string }
> = {
  40: {
    cell: 'p-[2mm]',
    qr: 'size-[27mm]',
    code: 'mt-[0.8mm] text-[9pt]',
    title: 'mt-[0.5mm] line-clamp-1 text-[5.5pt] wrap-anywhere',
  },
  50: {
    cell: 'p-[2.5mm]',
    qr: 'size-[34mm]',
    code: 'mt-[1mm] text-[11pt]',
    title: 'mt-[0.6mm] line-clamp-1 text-[6.5pt] wrap-anywhere',
  },
  70: {
    cell: 'p-[3mm]',
    qr: 'size-[46mm]',
    code: 'mt-[1.5mm] text-[15pt]',
    title: 'mt-[1mm] line-clamp-2 text-[8.5pt] wrap-anywhere',
  },
}

type LabelGrid = {
  sizeMm: LabelSizeMm
  columns: number
  rows: number
  marginMm: number
  gapMm: number
}

function LabelStickers({ labels, grid }: { labels: readonly PrintLabel[]; grid: LabelGrid }) {
  const styles = STICKER_STYLES[grid.sizeMm]
  // Label paper is measured in mm: the grid comes from props, so it is set inline.
  const gridStyle: CSSProperties = {
    padding: `${grid.marginMm}mm`,
    gap: `${grid.gapMm}mm`,
    gridTemplateColumns: `repeat(${grid.columns}, ${grid.sizeMm}mm)`,
    gridAutoRows: `${grid.sizeMm}mm`,
  }
  return (
    <ul className="grid content-start justify-start" style={gridStyle}>
      {labels.map((label) => (
        <li
          key={label.code}
          className={cn(
            'flex flex-col items-center justify-center overflow-hidden rounded-[1.5mm] border text-center',
            CUT_LINE,
            styles.cell,
          )}
        >
          <QrCode
            value={label.url}
            label={`${label.code} QR kodu`}
            quietZone={2}
            className={cn('shrink-0', styles.qr)}
          />
          <span
            className={cn('font-mono font-bold tracking-wide text-fg', styles.code, 'leading-none')}
          >
            {label.code}
          </span>
          <span className={cn('w-full text-fg-muted', styles.title, 'leading-tight')}>
            {label.title}
          </span>
        </li>
      ))}
    </ul>
  )
}

function resolveLabelGrid(
  props: Pick<PrintSheetProps, 'labelSizeMm' | 'columns' | 'rows' | 'marginMm' | 'gapMm'>,
): LabelGrid {
  const sizeMm =
    props.labelSizeMm !== undefined && LABEL_SIZES_MM.includes(props.labelSizeMm)
      ? props.labelSizeMm
      : LABEL_DEFAULTS.sizeMm
  const marginMm = toLength(props.marginMm, 60) ?? LABEL_DEFAULTS.marginMm
  const gapMm = toLength(props.gapMm, 30) ?? LABEL_DEFAULTS.gapMm
  const fit = fitLabelGrid(sizeMm, marginMm, gapMm)
  return {
    sizeMm,
    marginMm,
    gapMm,
    columns: toCount(props.columns, 20) ?? fit.columns,
    rows: toCount(props.rows, 30) ?? fit.rows,
  }
}

function labelPages(labels: readonly PrintLabel[], grid: LabelGrid) {
  return paginate(labels, grid.columns * grid.rows).map((chunk, index): SheetPage => ({
    key: `label-${index}`,
    back: false,
    content: <LabelStickers labels={chunk} grid={grid} />,
  }))
}

// ---------------------------------------------------------------------------------------------
// Box template — A6 kit-box label, 4 per A4
// ---------------------------------------------------------------------------------------------

function BoxLabel({
  kit,
  cards,
  kitTitle,
  note,
  entryMode,
}: {
  kit: PrintLabel
  cards: readonly PrintLabel[]
  kitTitle: string
  note: string | undefined
  entryMode: QrEntryMode
}) {
  const listed = cards.length > BOX_CARD_LIMIT ? cards.slice(0, BOX_CARD_LIMIT - 1) : cards
  const more = cards.length - listed.length
  return (
    <>
      <p className="text-[8pt] leading-none font-semibold text-primary">Kâşif bilim kiti</p>
      <p className="mt-[1.5mm] line-clamp-2 text-[17pt] leading-tight font-bold wrap-anywhere text-fg">
        {kitTitle}
      </p>

      <div className="mt-[4mm] flex items-center gap-[4mm]">
        <QrCode
          value={kit.url}
          label={`${kit.code} QR kodu`}
          quietZone={2}
          className="size-[40mm] shrink-0"
        />
        <div className="flex min-w-0 flex-col items-start gap-[2mm]">
          <span className="text-[7.5pt] leading-none text-fg-muted">{kit.caption}</span>
          <CodePill size="text-[18pt]">{kit.code}</CodePill>
          <ScanHint size="text-[7.5pt]" />
        </div>
      </div>

      <p className="mt-[5mm] text-[9pt] font-bold text-fg">Nasıl kullanılır?</p>
      <ol className="mt-[1.5mm] flex flex-col gap-[1.2mm] text-[8.5pt] leading-tight text-fg">
        {BOX_STEPS[entryMode].map((step, index) => (
          <li key={step} className="flex items-center gap-[2mm]">
            <span
              aria-hidden="true"
              className="grid size-[4.5mm] shrink-0 place-items-center rounded-full bg-primary text-[7pt] font-bold text-primary-fg"
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {cards.length > 0 && (
        <>
          <p className="mt-[4.5mm] text-[9pt] font-bold text-fg">Kartlar</p>
          <ul className="mt-[1.5mm] grid grid-cols-2 gap-x-[3mm] gap-y-[0.9mm] text-[7pt] leading-tight">
            {listed.map((card) => (
              <li key={card.code} className="flex min-w-0 gap-[1.5mm]">
                <span className="shrink-0 font-mono font-bold text-fg">{card.code}</span>
                <span className="truncate text-fg-muted">{card.title}</span>
              </li>
            ))}
            {more > 0 && <li className="text-fg-muted">+{more} kart daha</li>}
          </ul>
        </>
      )}

      {note && <p className="mt-auto pt-[3mm] text-[7pt] leading-snug text-fg-muted">{note}</p>}
    </>
  )
}

/** Reading-order positions of the A6 labels on the sheet. */
const BOX_SLOTS = Array.from({ length: BOX_GRID.columns * BOX_GRID.rows }, (_, slot) => slot)

function boxPages(
  labels: readonly PrintLabel[],
  kitTitle: string,
  note: string | undefined,
  entryMode: QrEntryMode,
): SheetPage[] {
  const { kit, cards } = splitKitLabel(labels)
  if (!kit) return []
  const content = (
    <ul className="grid auto-rows-[148mm] grid-cols-[repeat(2,105mm)]">
      {BOX_SLOTS.map((slot) => (
        <li
          key={slot}
          // Identical copies: screen readers get the first one only.
          aria-hidden={slot > 0 || undefined}
          className={cn(
            'flex flex-col overflow-hidden p-[8mm]',
            CUT_LINE,
            slot % BOX_GRID.columns === 0 && 'border-r',
            slot < BOX_GRID.columns && 'border-b',
          )}
        >
          <BoxLabel kit={kit} cards={cards} kitTitle={kitTitle} note={note} entryMode={entryMode} />
        </li>
      ))}
    </ul>
  )
  return [{ key: 'box-0', back: false, content }]
}

// ---------------------------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------------------------

/**
 * Printable A4 sheets (cards, equipment labels or kit-box labels). On screen each page is a
 * white sheet; printing (or "Save as PDF") outputs exactly one sheet per page. Sheets always use
 * the light theme so they stay dark-on-white.
 */
export function PrintSheet({
  template,
  labels,
  labelSizeMm,
  columns,
  rows,
  marginMm,
  gapMm,
  backNote,
  kitTitle,
  entryMode = 'focused',
  className,
}: PrintSheetProps) {
  if (labels.length === 0) {
    return (
      <EmptyState
        titleAs="p"
        title="Yazdırılacak QR kodu yok"
        description="Kite kart eklediğinizde kartların QR kodları burada yazdırmaya hazır olur."
        className={className}
      />
    )
  }

  const note = backNote?.trim() || undefined
  const grid =
    template === 'label' ? resolveLabelGrid({ labelSizeMm, columns, rows, marginMm, gapMm }) : null
  const pages =
    template === 'card'
      ? cardPages(labels, note, kitTitle)
      : template === 'box'
        ? boxPages(labels, kitTitle, note, entryMode)
        : grid
          ? labelPages(labels, grid)
          : []
  const overflows = grid !== null && !labelGridFits(grid)

  return (
    <div className={cn('qr-print-root overflow-x-auto print:overflow-visible', className)}>
      <style>{PRINT_CSS}</style>
      {overflows && (
        <Alert variant="warning" className="no-print mx-auto mb-4 max-w-[210mm]">
          Etiketler A4 sayfaya sığmıyor. Sütun ya da satır sayısını, kenar boşluğunu veya aralığı
          küçültün.
        </Alert>
      )}
      <div className="mx-auto flex w-max flex-col gap-8 py-2 print:m-0 print:block print:w-auto print:p-0">
        {pages.map((page, index) => (
          <section
            key={page.key}
            data-theme="light"
            aria-label={`Sayfa ${index + 1} / ${pages.length}${page.back ? ', arka yüz' : ''}`}
            className="qr-print-page relative h-[297mm] w-[210mm] overflow-hidden bg-surface font-sans text-fg shadow-lg ring-1 ring-border print:h-[296mm] print:shadow-none print:ring-0"
          >
            {page.content}
          </section>
        ))}
      </div>
    </div>
  )
}
