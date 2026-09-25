import { readFile } from 'node:fs/promises'

import jsQRModule from 'jsqr'
import JSZip from 'jszip'
import { PNG } from 'pngjs'

/** Decodes the QR code in a PNG (as rendered by the Studio's QR export). */
export function decodePngQr(png: Buffer) {
  const image = PNG.sync.read(png)
  const pixels = new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.length)
  // CommonJS package: under Node ESM the default import is the module object.
  return jsQRModule.default(pixels, image.width, image.height)?.data ?? null
}

/** File names and contents of a downloaded ZIP. */
export async function readZip(path: string) {
  const zip = await JSZip.loadAsync(await readFile(path))
  const files = Object.values(zip.files).filter((file) => !file.dir)
  return Promise.all(
    files.map(async (file) => ({ name: file.name, data: await file.async('nodebuffer') })),
  )
}

/** Number of pages in a PDF produced by `page.pdf()`. */
export function pdfPageCount(pdf: Buffer) {
  return pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0
}
