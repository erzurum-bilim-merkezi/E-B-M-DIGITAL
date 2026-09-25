import { QR_SCAN_SOURCE_LABELS } from '@/entities/activity'
import { formatDuration } from '@/shared/lib/format'

import type { FeedItem } from '../api/port'

/** One Turkish sentence per event. */
export function describeActivity(item: FeedItem) {
  const card = item.stepTitle ? `“${item.stepTitle}”` : 'bir kart'
  const kit = item.kitTitle ? `“${item.kitTitle}”` : 'bir kit'
  switch (item.type) {
    case 'qr_scan':
      return `${item.code ?? ''} QR’ını okuttu${item.source ? ` (${QR_SCAN_SOURCE_LABELS[item.source].toLocaleLowerCase('tr')})` : ''}`
    case 'kit_open':
      return `${kit} kitini açtı`
    case 'card_open':
      return `${card} kartını açtı`
    case 'card_complete':
      return `${card} kartını tamamladı${item.durationMs ? ` · ${formatDuration(item.durationMs)}` : ''}`
    case 'quiz_answer':
      return `${card} sorusunu ${item.correct ? 'doğru' : 'yanlış'} cevapladı`
    case 'kit_complete':
      return `${kit} kitini bitirdi 🎉`
    case 'badge_earned':
      return `“${item.badgeName ?? 'rozet'}” rozetini kazandı`
    case 'certificate_view':
      return `${kit} sertifikasını görüntüledi`
  }
}
