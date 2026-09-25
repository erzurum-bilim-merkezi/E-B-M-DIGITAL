#!/usr/bin/env node
// Creates the FIRST Studio admin of the live project (runbook step, bootstrap-admin workflow).
// Refuses when any admin exists: after that, admins add each other in the Studio.
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=… \
//   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_TEMP_PASSWORD=… node scripts/bootstrap-admin.mjs
// The temporary password must be changed at the first sign-in (72 h), then TOTP is enrolled.
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
const email = required('ADMIN_EMAIL').toLowerCase()
const name = required('ADMIN_NAME')
const password = required('ADMIN_TEMP_PASSWORD')

if (password.length < 10 || !/[a-zçğıöşü]/i.test(password) || !/\d/.test(password)) {
  console.error('ADMIN_TEMP_PASSWORD: at least 10 characters with letters and a digit')
  process.exit(1)
}
if (name.length < 2 || name.length > 60) {
  console.error('ADMIN_NAME: 2–60 characters')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const existing = await admin.from('profiles').select('id').eq('role', 'admin').limit(1)
if (existing.error) {
  console.error(`Could not read profiles: ${existing.error.message}`)
  process.exit(1)
}
if (existing.data.length > 0) {
  console.error('An admin already exists. Add further admins in Kâşif Studio → Kullanıcılar.')
  process.exit(1)
}

const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (created.error || !created.data.user) {
  console.error(`Could not create the account: ${created.error?.message ?? 'no user returned'}`)
  process.exit(1)
}
const id = created.data.user.id
// staff_bootstrap_admin re-checks "no admin yet" under a lock, marks the temporary password
// (72 h, must change) and writes the audit entry.
const profile = await admin.rpc('staff_bootstrap_admin', {
  p_user: id,
  p_email: email,
  p_display_name: name,
})
if (profile.error) {
  await admin.auth.admin.deleteUser(id)
  console.error(`Could not create the profile: ${profile.error.message}`)
  process.exit(1)
}
console.warn(`✔ First admin created for ${email}. Sign in, change the password, enrol TOTP.`)
