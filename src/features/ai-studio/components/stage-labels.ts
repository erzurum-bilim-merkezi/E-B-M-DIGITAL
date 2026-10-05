import type { AiProgress } from '../api/port'

/** What a running generation is doing, as the panels announce it. */
export const STAGE_LABELS: Record<AiProgress['stage'], string> = {
  queued: 'Sıraya alındı…',
  drawing: 'Çiziliyor…',
  checking: 'Güvenlik kontrolü…',
  done: 'Hazır',
}
