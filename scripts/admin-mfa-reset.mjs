#!/usr/bin/env node
// Emergency: removes the TOTP authenticators of one Studio account whose phone was lost, so the
// admin can enrol a new one at the next sign-in (runbook, admin-mfa-reset workflow).
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… ACCOUNT_EMAIL=… node scripts/admin-mfa-reset.mjs
import { createClient } from '@supabase/supabase-js'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`${name} is required`)
    process.exit(1)
  }
  return value
}

const url = required('SUPABASE_URL')
const key = required('SUPABASE_SECRET_KEY')
const email = required('ACCOUNT_EMAIL').toLowerCase()

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const profile = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
if (profile.error || !profile.data) {
  console.error(`No Studio account for ${email}`)
  process.exit(1)
}
const userId = profile.data.id
const factors = await admin.auth.admin.mfa.listFactors({ userId })
if (factors.error) {
  console.error(`Could not list the authenticators: ${factors.error.message}`)
  process.exit(1)
}
const removals = await Promise.all(
  factors.data.factors.map((factor) =>
    admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id }),
  ),
)
const failed = removals.find((removal) => removal.error)
if (failed?.error) {
  console.error(`Could not remove an authenticator: ${failed.error.message}`)
  process.exit(1)
}
// Every session ends now: whoever holds the lost phone's session cannot renew it, and its
// access token runs out within jwt_expiry (30 min). The next sign-in asks for a new authenticator.
const ended = await admin.rpc('staff_end_sessions', { p_user: userId })
if (ended.error) {
  console.error(
    `Authenticators removed, but the sessions could not be ended: ${ended.error.message}`,
  )
  process.exit(1)
}
await admin.from('audit_log').insert({
  actor_id: null,
  action: 'auth.mfa_reset',
  entity: 'staff_user',
  entity_id: userId,
  meta: { factors: factors.data.factors.length },
})
console.warn(`✔ Removed ${factors.data.factors.length} authenticator(s) of ${email}.`)
