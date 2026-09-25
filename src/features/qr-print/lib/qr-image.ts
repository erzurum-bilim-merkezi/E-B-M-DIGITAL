import { slugifyTr } from '@/entities/kit'
import { createQrMatrix, qrSvgPath, type QrMatrix } from '@/shared/ui'

/** Everything printed on one QR image, card or label. */
export type QrLabel = {
  /** `KC-01` (card) or `KC` (kit) — printed so children can type it when scanning fails. */
  code: string
  /** Target encoded in the QR: `buildQrUrl(siteUrl, code)`. */
  url: string
  title: string
  /** Line above the title, e.g. "Kart 3" or "Kit kodu". */
  caption: string
}

// ---------------------------------------------------------------------------------------------
// File names
// ---------------------------------------------------------------------------------------------

const FILE_NAME_MAX_LENGTH = 60

/** `("KC-01", "Tohum nedir?")` → `kc-01-tohum-nedir` (no extension). */
export function qrFileName(code: string, title: string) {
  return slugifyTr(`${code} ${title}`, FILE_NAME_MAX_LENGTH) || 'qr'
}

function qrArchiveName(kitSlug: string) {
  return `${slugifyTr(kitSlug) || 'kit'}-qr-kodlari`
}

/** `kucuk-ciftciler` → `kucuk-ciftciler-qr-kodlari.zip`. */
export function qrZipFileName(kitSlug: string) {
  return `${qrArchiveName(kitSlug)}.zip`
}

// ---------------------------------------------------------------------------------------------
// Line wrapping (pure: the text measure is injected)
// ---------------------------------------------------------------------------------------------

const ELLIPSIS = '…'

/**
 * Greedy word wrap into at most `maxLines` lines no wider than `maxWidth`. Words longer than a
 * line are broken by character; overflowing text ends with an ellipsis on the last line.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
  maxLines = 2,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || maxLines < 1) return []

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    const pieces = measure(word) <= maxWidth ? [word] : breakWord(word, maxWidth, measure)
    current = pieces.pop() ?? ''
    lines.push(...pieces)
  }
  if (current) lines.push(current)

  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  const last = kept.pop() ?? ''
  return [...kept, withEllipsis(last, maxWidth, measure)]
}

function breakWord(word: string, maxWidth: number, measure: (text: string) => number) {
  const pieces: string[] = []
  let piece = ''
  for (const char of Array.from(word)) {
    if (piece && measure(piece + char) > maxWidth) {
      pieces.push(piece)
      piece = char
    } else {
      piece += char
    }
  }
  if (piece) pieces.push(piece)
  return pieces
}

function withEllipsis(line: string, maxWidth: number, measure: (text: string) => number) {
  const chars = Array.from(line)
  const render = () => `${chars.join('').trimEnd()}${ELLIPSIS}`
  while (chars.length > 0 && measure(render()) > maxWidth) chars.pop()
  return render()
}

// ---------------------------------------------------------------------------------------------
// Image layout — shared by the PNG (canvas) and SVG renderers
// ---------------------------------------------------------------------------------------------

export type FontFamily = 'sans' | 'mono'
/** Advance width in px of `text` set in `family` at `px` and `weight`. */
export type FontMeasure = (text: string, px: number, family: FontFamily, weight: number) => number

/** Printed artwork is always dark ink on white paper, whatever the UI theme. */
const INK = {
  paper: '#FFFFFF',
  qr: '#000000',
  brand: '#3B3486',
  text: '#1F2A44',
  muted: '#545A73',
  pill: '#F1F0FB',
} as const

const FONT_STACKS: Record<FontFamily, string> = {
  sans: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'Cascadia Code', Consolas, Menlo, monospace",
}

const IMAGE_WIDTH = 1024
/** QR modules of white margin around the code (ISO/IEC 18004 minimum). */
const QUIET_ZONE = 4
const TEXT_MAX_WIDTH = IMAGE_WIDTH - 2 * 72
const CAPTION = { px: 46, weight: 700 } as const
const TITLE = { maxPx: 58, minPx: 34, step: 4, weight: 700, lineHeight: 1.2, maxLines: 2 } as const
const CODE = { px: 68, weight: 700, padX: 44, padY: 22, stroke: 4 } as const
const FOOTER = { px: 30, weight: 600, text: 'Kâşif ile okut' } as const
const BOTTOM_PADDING = 52

export type QrImageLayout = {
  width: number
  height: number
  qr: { x: number; y: number; cell: number }
  caption: { text: string; baseline: number } | null
  title: { lines: string[]; px: number; baselines: number[] }
  code: {
    text: string
    baseline: number
    box: { x: number; y: number; width: number; height: number }
  }
  footer: { text: string; baseline: number }
}

const TITLE_SIZES = Array.from(
  { length: Math.floor((TITLE.maxPx - TITLE.minPx) / TITLE.step) + 1 },
  (_, index) => TITLE.maxPx - index * TITLE.step,
)

/**
 * Largest title size that fits on two lines — first without breaking a word, then with; when
 * nothing fits even at the minimum size, the second line ends with an ellipsis.
 */
function fitTitle(title: string, measure: FontMeasure) {
  const words = title.trim().split(/\s+/).filter(Boolean)
  const measureAt = (px: number) => (text: string) => measure(text, px, 'sans', TITLE.weight)

  for (const breakWords of [false, true]) {
    for (const px of TITLE_SIZES) {
      const fitsLine = measureAt(px)
      if (!breakWords && words.some((word) => fitsLine(word) > TEXT_MAX_WIDTH)) continue
      const lines = wrapLines(title, TEXT_MAX_WIDTH, fitsLine, Number.POSITIVE_INFINITY)
      if (lines.length <= TITLE.maxLines) return { px, lines }
    }
  }
  return {
    px: TITLE.minPx,
    lines: wrapLines(title, TEXT_MAX_WIDTH, measureAt(TITLE.minPx), TITLE.maxLines),
  }
}

/**
 * Positions of every element of the 1024 px wide label image: the QR with its quiet zone, then
 * caption, title (≤ 2 lines, font shrinks to fit), the code in a pill and the footer.
 * Text positions are alphabetic baselines, x is always the horizontal centre.
 */
export function layoutQrImage(
  label: QrLabel,
  moduleCount: number,
  measure: FontMeasure,
): QrImageLayout {
  const cell = Math.max(1, Math.floor(IMAGE_WIDTH / (moduleCount + QUIET_ZONE * 2)))
  const qrSize = cell * moduleCount
  const offset = Math.floor((IMAGE_WIDTH - qrSize) / 2)
  let y = offset + qrSize + QUIET_ZONE * cell

  const captionText = label.caption.trim()
  let caption: QrImageLayout['caption'] = null
  if (captionText) {
    caption = { text: captionText, baseline: y + CAPTION.px }
    y += Math.round(CAPTION.px * 1.3)
  }

  const title = fitTitle(label.title, measure)
  const lineHeight = Math.round(title.px * TITLE.lineHeight)
  const baselines = title.lines.map((_, index) => y + title.px + index * lineHeight)
  if (title.lines.length > 0) y += title.lines.length * lineHeight

  y += 28
  const codeWidth = measure(label.code, CODE.px, 'mono', CODE.weight)
  const boxWidth = Math.min(TEXT_MAX_WIDTH, Math.round(codeWidth + CODE.padX * 2))
  const boxHeight = CODE.px + CODE.padY * 2
  const box = { x: Math.round((IMAGE_WIDTH - boxWidth) / 2), y, width: boxWidth, height: boxHeight }
  const codeBaseline = Math.round(y + boxHeight / 2 + CODE.px * 0.36)
  y += boxHeight + 30

  const footer = { text: FOOTER.text, baseline: y + FOOTER.px }
  y += Math.round(FOOTER.px * 1.3) + BOTTOM_PADDING

  return {
    width: IMAGE_WIDTH,
    height: y,
    qr: { x: offset, y: offset, cell },
    caption,
    title: { lines: title.lines, px: title.px, baselines },
    code: { text: label.code, baseline: codeBaseline, box },
    footer,
  }
}

/**
 * Deterministic width estimate for SVG output, where no text metrics exist. Errs on the wide
 * side so wrapped lines never overflow the image.
 */
export function estimateTextWidth(text: string, px: number, family: FontFamily) {
  if (family === 'mono') return Array.from(text).length * px * 0.62
  let ems = 0
  for (const char of Array.from(text)) {
    if (char === ' ') ems += 0.3
    else if ("iljıİI.,:;!|'".includes(char)) ems += 0.32
    else if ('ftr'.includes(char)) ems += 0.42
    else if ('mwMW'.includes(char)) ems += 0.92
    else if (/\p{Lu}/u.test(char)) ems += 0.72
    else if (/[\p{Ll}\p{N}]/u.test(char)) ems += 0.6
    else if (/\p{Extended_Pictographic}/u.test(char)) ems += 1.2
    else ems += 0.62
  }
  return ems * px * 1.04
}

// ---------------------------------------------------------------------------------------------
// PNG (canvas)
// ---------------------------------------------------------------------------------------------

function canvasFont(px: number, family: FontFamily, weight: number) {
  return `${weight} ${px}px ${FONT_STACKS[family]}`
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
) {
  const radius = Math.min(height, width) / 2
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

function drawLabel(context: CanvasRenderingContext2D, matrix: QrMatrix, layout: QrImageLayout) {
  const centerX = layout.width / 2
  context.fillStyle = INK.paper
  context.fillRect(0, 0, layout.width, layout.height)

  context.fillStyle = INK.qr
  const { x, y, cell } = layout.qr
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) context.fillRect(x + col * cell, y + row * cell, cell, cell)
    }
  }

  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  if (layout.caption) {
    context.font = canvasFont(CAPTION.px, 'sans', CAPTION.weight)
    context.fillStyle = INK.brand
    context.fillText(layout.caption.text, centerX, layout.caption.baseline)
  }

  context.font = canvasFont(layout.title.px, 'sans', TITLE.weight)
  context.fillStyle = INK.text
  layout.title.lines.forEach((line, index) => {
    context.fillText(line, centerX, layout.title.baselines[index] ?? 0)
  })

  roundedRectPath(context, layout.code.box)
  context.fillStyle = INK.pill
  context.fill()
  context.lineWidth = CODE.stroke
  context.strokeStyle = INK.brand
  context.stroke()
  context.font = canvasFont(CODE.px, 'mono', CODE.weight)
  context.fillStyle = INK.text
  context.fillText(layout.code.text, centerX, layout.code.baseline)

  context.font = canvasFont(FOOTER.px, 'sans', FOOTER.weight)
  context.fillStyle = INK.muted
  context.fillText(layout.footer.text, centerX, layout.footer.baseline)
}

/**
 * 1024 px wide PNG label: QR (error correction M, quiet zone 4) with caption, title, the code in
 * a pill and "Kâşif ile okut" underneath. Rendered in the browser; nothing is stored.
 */
export async function renderQrPng(label: QrLabel): Promise<Blob> {
  const matrix = createQrMatrix(label.url, 'M')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not available.')

  const layout = layoutQrImage(label, matrix.size, (text, px, family, weight) => {
    context.font = canvasFont(px, family, weight)
    return context.measureText(text).width
  })
  // Resizing resets the context state, so the layout is measured first.
  canvas.width = layout.width
  canvas.height = layout.height
  drawLabel(context, matrix, layout)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
      'image/png',
    )
  })
}

// ---------------------------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------------------------

/** XML 1.0 forbids most control characters, lone surrogates and U+FFFE/U+FFFF. */
function isXmlChar(char: string) {
  const code = char.codePointAt(0) ?? 0
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true
  if (code < 0x20) return false
  // The string iterator yields paired surrogates as one code point, so these are lone halves.
  if (code >= 0xd800 && code <= 0xdfff) return false
  return code !== 0xfffe && code !== 0xffff
}

function escapeXml(value: string) {
  return Array.from(value)
    .filter(isXmlChar)
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function svgText(
  text: string,
  baseline: number,
  { px, family, weight, fill }: { px: number; family: FontFamily; weight: number; fill: string },
) {
  return `<text x="${IMAGE_WIDTH / 2}" y="${baseline}" font-family="${escapeXml(FONT_STACKS[family])}" font-size="${px}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`
}

/** Standalone SVG document with the same layout as the PNG (text stays selectable/vector). */
export function renderQrSvg(label: QrLabel): string {
  const matrix = createQrMatrix(label.url, 'M')
  const layout = layoutQrImage(label, matrix.size, (text, px, family) =>
    estimateTextWidth(text, px, family),
  )
  const { path } = qrSvgPath(matrix, 0)
  const { box } = layout.code
  const title = [label.caption, label.title, label.code]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ')

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="qr-title">`,
    `<title id="qr-title">${escapeXml(title)}</title>`,
    `<rect width="${layout.width}" height="${layout.height}" fill="${INK.paper}"/>`,
    `<path transform="translate(${layout.qr.x} ${layout.qr.y}) scale(${layout.qr.cell})" shape-rendering="crispEdges" fill="${INK.qr}" d="${path}"/>`,
    '<g text-anchor="middle">',
    layout.caption
      ? svgText(layout.caption.text, layout.caption.baseline, {
          px: CAPTION.px,
          family: 'sans',
          weight: CAPTION.weight,
          fill: INK.brand,
        })
      : '',
    ...layout.title.lines.map((line, index) =>
      svgText(line, layout.title.baselines[index] ?? 0, {
        px: layout.title.px,
        family: 'sans',
        weight: TITLE.weight,
        fill: INK.text,
      }),
    ),
    `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${box.height / 2}" fill="${INK.pill}" stroke="${INK.brand}" stroke-width="${CODE.stroke}"/>`,
    svgText(layout.code.text, layout.code.baseline, {
      px: CODE.px,
      family: 'mono',
      weight: CODE.weight,
      fill: INK.text,
    }),
    svgText(layout.footer.text, layout.footer.baseline, {
      px: FOOTER.px,
      family: 'sans',
      weight: FOOTER.weight,
      fill: INK.muted,
    }),
    '</g>',
    '</svg>',
  ]
  return `${parts.filter(Boolean).join('\n')}\n`
}

// ---------------------------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------------------------

function uniqueName(name: string, used: Set<string>) {
  let candidate = name
  for (let suffix = 2; used.has(candidate); suffix++) candidate = `${name}-${suffix}`
  used.add(candidate)
  return candidate
}

/**
 * One PNG per label in a `<kit>-qr-kodlari/` folder. `jszip` is loaded on demand; labels are
 * rendered one after another so progress can be reported.
 */
export async function buildQrZip(
  labels: readonly QrLabel[],
  kitSlug: string,
  onProgress?: (done: number, total: number) => void,
  renderPng: (label: QrLabel) => Promise<Blob> = renderQrPng,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = qrArchiveName(kitSlug)
  const usedNames = new Set<string>()
  const total = labels.length

  onProgress?.(0, total)
  let done = 0
  for (const label of labels) {
    const fileName = uniqueName(qrFileName(label.code, label.title), usedNames)
    // oxlint-disable-next-line no-await-in-loop -- one canvas at a time, with progress
    zip.file(`${folder}/${fileName}.png`, await renderPng(label))
    done += 1
    onProgress?.(done, total)
  }
  // PNGs are already compressed: store them (JSZip's default) instead of deflating again.
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}
