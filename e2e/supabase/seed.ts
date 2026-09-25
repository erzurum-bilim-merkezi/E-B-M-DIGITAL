// Seeds the LOCAL Supabase stack (CI) with the Studio accounts the Supabase E2E specs sign in with:
// an admin with a verified TOTP factor and an editor. Never runs against a non-local URL.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_DB_URL=… node e2e/supabase/seed.ts
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

import { SUPABASE_E2E } from './accounts.ts'

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required (supabase status -o env)`)
  return value
}

const url = required('SUPABASE_URL')
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
const dbUrl = required('SUPABASE_DB_URL')
for (const target of [url, dbUrl]) {
  const host = new URL(target).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`E2E seeding runs on the local stack only (got ${host}).`)
  }
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
// oxlint-disable-next-line import/no-named-as-default-member -- pg is CommonJS: Client lives on the default export
const db = new pg.Client({ connectionString: dbUrl })
await db.connect()

try {
  for (const account of Object.values(SUPABASE_E2E)) {
    // oxlint-disable-next-line no-await-in-loop -- accounts are created one after another
    const created = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    })
    if (created.error || !created.data.user) throw created.error ?? new Error('createUser failed')
    const id = created.data.user.id
    // oxlint-disable-next-line no-await-in-loop -- see above
    await db.query(
      `insert into public.profiles (id, email, display_name, role, must_change_password)
       values ($1, $2, $3, $4, false)`,
      [id, account.email, account.name, account.role],
    )
    if (account.totpSecret) {
      // oxlint-disable-next-line no-await-in-loop -- see above
      await db.query(
        `insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
         values (gen_random_uuid(), $1, 'Kâşif Studio', 'totp', 'verified', $2, now(), now())`,
        [id, account.totpSecret],
      )
    }
  }
  process.stdout.write(
    `✔ Seeded ${Object.keys(SUPABASE_E2E).length} Studio accounts on the local stack\n`,
  )
} finally {
  await db.end()
}
