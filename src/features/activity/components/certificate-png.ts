import { formatDate } from '@/shared/lib/format'

import type { CertificateData } from './Certificate'

/** Certificate as a PNG (share/download fallback when Web Share is unavailable). */
export async function renderCertificatePng(data: CertificateData): Promise<Blob> {
  const width = 1754
  const height = 1240
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas desteklenmiyor')
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#2a2575')
  gradient.addColorStop(1, '#0d0b2e')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(40, 40, width - 80, height - 80, 60)
  context.fill()
  context.strokeStyle = '#ffd653'
  context.lineWidth = 14
  context.beginPath()
  context.roundRect(70, 70, width - 140, height - 140, 44)
  context.stroke()

  const center = width / 2
  context.textAlign = 'center'
  context.fillStyle = '#4a5578'
  context.font = '600 40px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText('ERZURUM BİLİM MERKEZİ · KÂŞİF', center, 230)
  context.fillStyle = '#5148d6'
  context.font = '700 120px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText('Kâşif Sertifikası', center, 380)
  context.fillStyle = '#4a5578'
  context.font = '500 44px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText('Bu sertifika', center, 480)
  context.fillStyle = '#1f2a44'
  context.font = '700 140px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText(data.nickname, center, 640, width - 300)
  context.font = '500 46px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillText(
    `“${data.kitTitle}” kitinin tüm kartlarını tamamlayarak`,
    center,
    760,
    width - 300,
  )
  context.fillText(
    `${data.badgeName} rozetini kazandığı için verilmiştir.`,
    center,
    830,
    width - 300,
  )
  context.font = '120px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  context.fillText(data.badgeEmoji, center, 1000)
  context.font = '500 38px "Fredoka Variable", "Segoe UI", sans-serif'
  context.fillStyle = '#4a5578'
  context.textAlign = 'left'
  context.fillText(`Tarih: ${formatDate(data.completedAt)}`, 200, 1100)
  context.textAlign = 'right'
  context.fillText(`Kâşif no: #${data.displayCode}`, width - 200, 1100)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG oluşturulamadı'))),
      'image/png',
    ),
  )
}
