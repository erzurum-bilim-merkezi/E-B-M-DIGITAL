export type CsvCell = string | number | boolean | null | undefined

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
 * so "ş, ğ, İ" open correctly. Pure (no DOM): also used by Node-side code and tests.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}
