import { z } from 'zod'

import { mockTable } from './mock-db'
import { MOCK_TABLES } from './mock-tables'

/**
 * Audit trail of the mock backend (status changes, publishing, users, deletions, AI use).
 * Drafts are not audited on every keystroke — at most once per kit and user per hour.
 */
const auditRowSchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  action: z.string().max(60),
  entity: z.string().max(40),
  entityId: z.string().max(80).nullable(),
  meta: z.record(z.string(), z.unknown()),
  at: z.iso.datetime({ offset: true }),
})

const auditTable = mockTable(MOCK_TABLES.auditLog, auditRowSchema)
const MAX_ROWS = 2000

export function appendAudit(entry: {
  actorId: string | null
  action: string
  entity: string
  entityId?: string | null
  meta?: Record<string, unknown>
}) {
  const rows = auditTable.all()
  const next = {
    id: crypto.randomUUID(),
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? {},
    at: new Date().toISOString(),
  }
  auditTable.replaceAll([...rows.slice(-(MAX_ROWS - 1)), next])
}

export function readAudit() {
  return auditTable.all()
}
