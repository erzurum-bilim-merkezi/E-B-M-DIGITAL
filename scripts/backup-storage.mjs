#!/usr/bin/env node
// Weekly backup (db-backup workflow): copies every file of the `media` and `ai` buckets — uploads
// and AI drawings the database cannot rebuild — into <out>/<bucket>/<path>. The `published`
// bucket is left out: "Yayın dosyalarını yeniden üret" rebuilds it from the database.
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup-storage.mjs backup/storage
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`${name} is required`)
    process.exit(1)
  }
  return value
}

const out = process.argv[2] ?? 'backup/storage'
const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SECRET_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})
const PAGE = 1000

/** Every object path under `prefix` (folders have no id in a listing). */
async function objectsOf(bucket, prefix = '') {
  const found = []
  for (let offset = 0; ; offset += PAGE) {
    // oxlint-disable-next-line no-await-in-loop -- pages follow one another
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    for (const item of data) {
      const name = prefix ? `${prefix}/${item.name}` : item.name
      // oxlint-disable-next-line no-await-in-loop -- a folder is walked before the next entry
      if (item.id === null) found.push(...(await objectsOf(bucket, name)))
      else found.push(name)
    }
    if (data.length < PAGE) return found
  }
}

let files = 0
let bytes = 0
for (const bucket of ['media', 'ai']) {
  // oxlint-disable-next-line no-await-in-loop -- one bucket after the other
  for (const name of await objectsOf(bucket)) {
    // oxlint-disable-next-line no-await-in-loop -- one download at a time keeps memory flat
    const { data, error } = await admin.storage.from(bucket).download(name)
    if (error) throw new Error(`${bucket}/${name}: ${error.message}`)
    const target = path.join(out, bucket, name)
    // oxlint-disable-next-line no-await-in-loop -- see above
    await mkdir(path.dirname(target), { recursive: true })
    // oxlint-disable-next-line no-await-in-loop -- see above
    const body = Buffer.from(await data.arrayBuffer())
    // oxlint-disable-next-line no-await-in-loop -- see above
    await writeFile(target, body)
    files += 1
    bytes += body.length
  }
}
console.warn(`✔ Copied ${files} files (${Math.round(bytes / 1024)} KB) from media and ai.`)
