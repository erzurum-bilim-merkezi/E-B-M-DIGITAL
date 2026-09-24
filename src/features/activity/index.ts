// Kâşif activity: offline event queue → record_events, server progress + badges, certificate.
export { eventSink, progressService } from './api'
export type { EventSink, ProgressService, SendResult } from './api/port'
export {
  eventQueue,
  flushQueue,
  MAX_QUEUE_LENGTH,
  onFlushed,
  setTrackingEnabled,
  track,
} from './api/queue'
export {
  badgesQueryOptions,
  kitProgressSummary,
  progressKeys,
  progressQueryOptions,
  useActivitySync,
  useExplorerBadges,
  useExplorerProgress,
  useResetKitProgress,
} from './api/queries'
export { BadgeGrid, type KitBadgeInfo } from './components/Badges'
export { Certificate, type CertificateData } from './components/Certificate'
export { renderCertificatePng } from './components/certificate-png'
