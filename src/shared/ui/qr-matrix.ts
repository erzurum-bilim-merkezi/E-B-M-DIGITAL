// oxlint-disable-next-line import/no-named-as-default -- the package types declare `export =` only; the named `qrcode` export exists in the ESM build but is untyped
import qrcode from 'qrcode-generator'

export type QrMatrix = { size: number; isDark: (row: number, col: number) => boolean }

/** QR matrix with error correction M (~15 %: survives a scratched printed label). */
export function createQrMatrix(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const qr = qrcode(0, level)
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  return { size, isDark: (row, col) => qr.isDark(row, col) }
}

/** Crisp, scalable QR as SVG path (one path, no per-module elements). */
export function qrSvgPath(matrix: QrMatrix, quietZone = 4) {
  let path = ''
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col)) path += `M${col + quietZone} ${row + quietZone}h1v1h-1z`
    }
  }
  return { path, viewBox: matrix.size + quietZone * 2 }
}
