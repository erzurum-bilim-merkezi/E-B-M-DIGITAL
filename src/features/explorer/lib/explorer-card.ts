import { EXPLORER_CARD_PREFIX } from '@/entities/kit'
import { formatRestoreCode, type Explorer } from '@/entities/explorer'
import { MASCOT_PALETTES } from '@/shared/ui/kid'
import { createQrMatrix } from '@/shared/ui'

/** Kâşif card QR payload: not a URL, so a phone camera never opens it — only Kâşif reads it. */
export function explorerCardPayload(code: string) {
  return `${EXPLORER_CARD_PREFIX}${code}`
}

/** Kâşif card as a PNG (credit-card proportions, 1050×660). */
export async function renderExplorerCardPng(explorer: Explorer, code: string): Promise<Blob> {
  const width = 1050
  const height = 660
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas desteklenmiyor')
  const palette = MASCOT_PALETTES[explorer.avatar]

  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, palette.bg[0])
  gradient.addColorStop(1, palette.bg[1])
  context.fillStyle = gradient
  context.beginPath()
  context.roundRect(0, 0, width, height, 48)
  context.fill()

  context.fillStyle = 'rgba(255,255,255,0.9)'
  for (const [x, y, r] of [
    [80, 90, 4],
    [460, 70, 3],
    [520, 560, 4],
    [120, 590, 3],
    [640, 140, 3],
  ] as const) {
    context.beginPath()
    context.arc(x, y, r, 0, Math.PI * 2)
    context.fill()
  }

  context.fillStyle = '#ffffff'
  context.font = '700 44px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText('Kâşif kartı', 64, 110)
  context.font = '700 84px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText(explorer.nickname, 64, 250, 540)
  context.font = '500 34px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillStyle = 'rgba(255,255,255,0.85)'
  context.fillText(`#${explorer.displayCode}`, 64, 305)

  context.fillStyle = 'rgba(255,255,255,0.95)'
  context.font = '600 30px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText('Kâşif kodu', 64, 470)
  context.font = '700 58px ui-monospace, "Cascadia Code", Consolas, monospace'
  context.fillStyle = '#ffffff'
  context.fillText(formatRestoreCode(code), 64, 545, 560)
  context.font = '500 24px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillStyle = 'rgba(255,255,255,0.85)'
  context.fillText('Başka cihazda devam etmek için Kâşif’te “Kâşif kodum var”', 64, 600, 600)

  // QR panel
  const matrix = createQrMatrix(explorerCardPayload(code), 'M')
  const panel = 360
  const px = width - panel - 64
  const py = (height - panel) / 2
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(px, py, panel, panel, 28)
  context.fill()
  const cell = Math.floor((panel - 48) / matrix.size)
  const offset = px + (panel - cell * matrix.size) / 2
  const offsetY = py + (panel - cell * matrix.size) / 2
  context.fillStyle = '#000000'
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (matrix.isDark(row, col))
        context.fillRect(offset + col * cell, offsetY + row * cell, cell, cell)
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG oluşturulamadı'))),
      'image/png',
    ),
  )
}
