/** Anchor-based download (works in every browser; testable via Playwright's download event). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadText(text: string, fileName: string, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), fileName)
}

export function downloadJson(value: unknown, fileName: string) {
  downloadText(`${JSON.stringify(value, null, 2)}\n`, fileName, 'application/json')
}

type CsvCell = string | number | boolean | null | undefined

/** Text a spreadsheet would run as a formula (CSV injection, OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/

function csvEscape(cell: CsvCell) {
  if (cell === null || cell === undefined) return ''
  // Numbers stay numbers (-3 is data); text that starts like a formula is neutralised with '.
  const text = typeof cell === 'string' && FORMULA_START.test(cell) ? `'${cell}` : String(cell)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV for Turkish Excel: `;` separator (Excel TR uses `,` as the decimal mark) and a UTF-8 BOM
 * so "ş, ğ, İ" open correctly.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}
