// admin-users (ADR 0011): the parts of Studio user administration that need the auth admin API.
// The caller's own JWT runs every database step (staff_* RPCs check "active admin with TOTP",
// the last-admin guard and write the audit trail); the service role only touches auth.users.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  allowedOrigin,
  corsHeaders,
  errorResponse,
  failures,
  fromRpcError,
  json,
} from '../_shared/http.ts'
import { generateTempPassword } from '../_shared/temp-password.ts'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    email: z.email().max(254),
    displayName: z.string().trim().min(2).max(60),
    role: z.enum(['admin', 'editor']),
  }),
  z.object({ action: z.literal('reset-password'), userId: z.uuid() }),
  z.object({ action: z.literal('set-active'), userId: z.uuid(), active: z.boolean() }),
])

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw failures.unavailable()
  return value
}

async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw fromRpcError(error)
  return data as unknown
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request.headers.get('origin'), Deno.env.get('ALLOWED_ORIGIN'))
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) })
  try {
    if (request.method !== 'POST') throw failures.validation()
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) throw failures.unauthorized()

    const url = env('SUPABASE_URL')
    const caller = createClient(url, env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: NO_SESSION,
    })
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: NO_SESSION })

    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw failures.validation()
    await rpc(caller, 'staff_assert_admin')

    switch (body.data.action) {
      case 'create': {
        const { email, displayName, role } = body.data
        const tempPassword = generateTempPassword()
        const created = await admin.auth.admin.createUser({
          email: email.toLowerCase(),
          password: tempPassword,
          email_confirm: true,
        })
        if (created.error || !created.data.user) {
          if (created.error?.code === 'email_exists') {
            throw failures.conflict('Bu e-posta ile bir kullanıcı zaten var.')
          }
          throw failures.unavailable()
        }
        const userId = created.data.user.id
        try {
          const user = await rpc(caller, 'staff_register', {
            p_user: userId,
            p_email: email,
            p_display_name: displayName,
            p_role: role,
          })
          return json({ user, tempPassword }, 200, origin)
        } catch (error) {
          // No half-created accounts: remove the auth user again.
          await admin.auth.admin.deleteUser(userId)
          throw error
        }
      }
      case 'reset-password': {
        const tempPassword = generateTempPassword()
        const updated = await admin.auth.admin.updateUserById(body.data.userId, {
          password: tempPassword,
        })
        if (updated.error) throw failures.notFound('Kullanıcı bulunamadı.')
        await rpc(caller, 'staff_mark_password_reset', { p_user: body.data.userId })
        return json({ tempPassword }, 200, origin)
      }
      case 'set-active': {
        // The RPC refuses to deactivate the last admin; only then is the account banned.
        const user = await rpc(caller, 'staff_update', {
          p_user: body.data.userId,
          p_active: body.data.active,
        })
        const banned = await admin.auth.admin.updateUserById(body.data.userId, {
          ban_duration: body.data.active ? 'none' : '876000h',
        })
        if (banned.error) throw failures.unavailable()
        return json(user, 200, origin)
      }
    }
  } catch (error) {
    return errorResponse(error, origin)
  }
})
