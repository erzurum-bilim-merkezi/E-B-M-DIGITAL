#!/usr/bin/env node
// Checks that the live project keeps open every way in the app uses (runbook §1). CI rehearses on
// a local stack whose supabase/config.toml has them all on, so only the live settings can show one
// turned off — and a new Supabase project starts with anonymous sign-ins off, which leaves every
// Kâşif device at "Giriş şu an kapalı". Reads the public Auth settings with the publishable key.
//   URL=https://<ref>.supabase.co KEY=sb_publishable_… node scripts/check-live-auth.mjs

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`::error::${name} is required`)
    process.exit(1)
  }
  return value
}

const url = required('URL').replace(/\/+$/, '')
const key = required('KEY')

function report(settings) {
  const where = 'Supabase → Authentication → Sign In / Providers (docs/runbook/canliya-gecis.md §1)'
  const problems = [
    settings.external?.anonymous_users !== true &&
      `"Allow anonymous sign-ins" is off: no Kâşif device can join. Turn it on in ${where}.`,
    settings.disable_signup !== false &&
      `"Allow new users to sign up" is off: anonymous sign-ins depend on it. Turn it on in ${where}.`,
    settings.external?.email !== true &&
      `The Email provider is off: no staff member can sign in to Studio. Turn it on in ${where}.`,
  ].filter(Boolean)

  console.log(
    `anonymous sign-ins: ${settings.external?.anonymous_users} · sign-ups disabled: ${settings.disable_signup} · email: ${settings.external?.email}`,
  )
  for (const problem of problems) console.error(`::error::${problem}`)
  if (problems.length > 0) process.exitCode = 1
}

// From here on exitCode, never exit(): exiting while fetch's socket closes crashes Node on Windows.
await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: key },
  signal: AbortSignal.timeout(15_000),
})
  .then((response) => (response.ok ? response.json() : Promise.reject(`HTTP ${response.status}`)))
  .then(report)
  .catch((error) => {
    console.error(`::error::Could not read the live Auth settings (${error}).`)
    process.exitCode = 1
  })
