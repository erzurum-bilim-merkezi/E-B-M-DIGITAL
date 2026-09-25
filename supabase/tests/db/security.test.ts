/* oxlint-disable no-await-in-loop -- database calls run one after another */
import { dbError, setupTestDb } from './harness.ts'

const db = setupTestDb()

const PUBLIC_TABLES = [
  'profiles',
  'kits',
  'qr_prefix_reservations',
  'kit_versions',
  'qr_codes',
  'publish_state',
  'media_assets',
  'explorers',
  'explorer_secrets',
  'explorer_devices',
  'explorer_events',
  'explorer_kit_progress',
  'explorer_badges',
  'center_devices',
  'app_settings',
  'rate_limit_counters',
  'ai_usage',
  'audit_log',
]

describe('security model', () => {
  it('turns on row level security for every table', async () => {
    const rows = await db().sql<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    )
    expect(rows.map((row) => row.relname).toSorted()).toEqual(PUBLIC_TABLES.toSorted())
    expect(rows.filter((row) => !row.relrowsecurity)).toEqual([])
  })

  it('grants the API roles no write access to any table (writes go through RPCs)', async () => {
    const rows = await db().sql(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'authenticated')
         and privilege_type <> 'SELECT'`,
    )
    expect(rows).toEqual([])
  })

  it('grants anon nothing but the public probes', async () => {
    const tables = await db().sql(
      `select table_name from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'anon'`,
    )
    expect(tables).toEqual([])
    // Effective rights, PUBLIC grants included.
    const functions = await db().sql<{ proname: string }>(
      `select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'EXECUTE')
       order by p.proname`,
    )
    expect(functions.map((row) => row.proname)).toEqual(['ping', 'schema_version'])
  })

  it('exposes no private helper to signed-in users beyond what the read policies need', async () => {
    const functions = await db().sql<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       order by p.proname`,
    )
    expect(functions.map((row) => row.proname)).toEqual([
      'device_explorer_ids',
      'is_aal2',
      'is_active_staff',
      'is_admin',
      'is_anonymous',
      'staff_role',
    ])
  })

  it('keeps secrets, counters and the publish lease out of reach of every API role', async () => {
    const device = await db().createDevice()
    const admin = await db().createStaff({ role: 'admin' })
    for (const actor of [device, admin, { kind: 'anon' } as const]) {
      for (const table of ['explorer_secrets', 'rate_limit_counters', 'publish_state']) {
        const error = await dbError(db().as(actor).sql(`select * from public.${table}`))
        expect(error.code).toBe('42501') // insufficient_privilege
      }
    }
  })

  it('shows staff data to active staff only, and admins only after TOTP (aal2)', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })
    const adminWithoutTotp = await db().createStaff({ role: 'admin', aal: 'aal1' })
    const inactive = await db().createStaff({ role: 'editor', active: false })
    const device = await db().createDevice()
    await db().insertKit({ slug: 'deneme', qrPrefix: 'DN' })

    const visible = async (actor: Parameters<ReturnType<typeof db>['as']>[0]) =>
      (await db().as(actor).sql('select id from public.kits')).length

    expect(await visible(editor)).toBe(1)
    expect(await visible(admin)).toBe(1)
    expect(await visible(adminWithoutTotp)).toBe(0)
    expect(await visible(inactive)).toBe(0)
    expect(await visible(device)).toBe(0)
  })

  it('lets a user read only their own profile unless they are an admin', async () => {
    const editor = await db().createStaff({ role: 'editor' })
    const other = await db().createStaff({ role: 'editor' })
    const admin = await db().createStaff({ role: 'admin' })

    const own = await db().as(editor).sql<{ id: string }>('select id from public.profiles')
    expect(own.map((row) => row.id)).toEqual([editor.id])
    const all = await db().as(admin).sql<{ id: string }>('select id from public.profiles')
    expect(all.map((row) => row.id).toSorted()).toEqual([editor.id, other.id, admin.id].toSorted())
  })

  it('answers the keep-alive ping without a session', async () => {
    expect(await db().as({ kind: 'anon' }).rpc('ping')).toBe('pong')
  })
})
