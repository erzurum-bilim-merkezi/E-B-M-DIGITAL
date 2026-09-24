/**
 * Table and document names of the mock backend — the same names as the Supabase schema
 * (docs/database/schema.md), so mock adapters read like the SQL they stand in for.
 */
export const MOCK_TABLES = {
  staffUsers: 'staff_users',
  staffCredentials: 'staff_credentials',
  kits: 'kits',
  kitVersions: 'kit_versions',
  qrCodes: 'qr_codes',
  qrPrefixReservations: 'qr_prefix_reservations',
  mediaAssets: 'media_assets',
  explorers: 'explorers',
  explorerDevices: 'explorer_devices',
  explorerSecrets: 'explorer_secrets',
  explorerEvents: 'explorer_events',
  explorerProgress: 'explorer_kit_progress',
  explorerBadges: 'explorer_badges',
  centerDevices: 'center_devices',
  aiUsage: 'ai_usage',
  auditLog: 'audit_log',
  rateLimits: 'rate_limit_counters',
  clientErrors: 'client_errors_daily',
} as const

export const MOCK_DOCS = {
  settings: 'app_settings',
  publishState: 'publish_state',
  catalog: 'published/catalog.json',
  qrIndex: 'published/qr-index.json',
  latest: (slug: string) => `published/kits/${slug}/latest.json`,
  version: (slug: string, version: number) => `published/kits/${slug}/v${version}.json`,
} as const
