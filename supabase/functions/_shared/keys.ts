/**
 * The project's API keys, as the Edge runtime provides them. Hosted projects pass the named keys
 * (`SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`, JSON such as `{"default":"sb_…"}`), a
 * self-hosted or exported setup the single ones, and the legacy `anon` / `service_role` keys come
 * last: a project may have them turned off. Undefined when none is set.
 */
export function projectKeys(get: (name: string) => string | undefined) {
  return {
    publishable:
      named(get('SUPABASE_PUBLISHABLE_KEYS')) ??
      present(get('SUPABASE_PUBLISHABLE_KEY')) ??
      present(get('SUPABASE_ANON_KEY')),
    secret:
      named(get('SUPABASE_SECRET_KEYS')) ??
      present(get('SUPABASE_SECRET_KEY')) ??
      present(get('SUPABASE_SERVICE_ROLE_KEY')),
  }
}

function present(value: string | undefined) {
  return value?.trim() || undefined
}

/** The "default" key of a named-keys JSON object, else its first key. */
function named(json: string | undefined) {
  if (!json?.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const values = Object.entries(parsed)
    const chosen = values.find(([name]) => name === 'default') ?? values[0]
    return typeof chosen?.[1] === 'string' ? present(chosen[1]) : undefined
  } catch {
    return undefined
  }
}
