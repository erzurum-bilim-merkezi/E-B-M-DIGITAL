-- Kâşif v1 security model (ADR 0021): helpers in an unexposed `private` schema, no table grants
-- to anon, read-only grants + RLS for signed-in users, every write through a definer RPC.
--
-- Two kinds of signed-in users share the `authenticated` role:
--   * staff: a Studio account with a `profiles` row (admins must have passed TOTP → aal2)
--   * devices: anonymous sign-ins of the Kâşif app (`is_anonymous` claim), linked to members
-- Staff checks therefore never trust the role alone: private.staff_role() is null for devices.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Supabase grants everything in `public` to anon/authenticated by default: take it back and grant
-- explicitly below. Functions are executable by PUBLIC by default in PostgreSQL: revoke too.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
-- EXECUTE for PUBLIC is a global default that per-schema defaults cannot take back: revoke it
-- globally (for functions created by this role from here on), then per schema for the API roles.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Errors: SQLSTATE KSxxx ↔ AppError code (src/shared/api/supabase/errors.ts)
-- ---------------------------------------------------------------------------------------------

create function private.raise(p_code text, p_message text, p_details jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_state text := case p_code
    when 'unauthorized' then 'KS401'
    when 'forbidden' then 'KS403'
    when 'not_found' then 'KS404'
    when 'conflict' then 'KS409'
    when 'validation' then 'KS422'
    when 'rate_limited' then 'KS429'
    when 'quota' then 'KS430'
    else 'KS500'
  end;
begin
  raise exception using
    errcode = v_state,
    message = p_message,
    detail = coalesce(p_details, '{}'::jsonb)::text;
end;
$$;

-- An error as a value: RPCs that must keep a failure counter return this instead of raising
-- (raising would roll the counter back).
create function private.error(p_code text, p_message text, p_details jsonb default '{}')
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', p_code, 'message', p_message, 'details', p_details)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- Who is calling
-- ---------------------------------------------------------------------------------------------

create function private.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create function private.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Role of the calling Studio user, or null (devices, inactive staff, anon). A temporary password
-- must be changed first: until then the session can do nothing else (my_staff_profile,
-- verify_current_password and complete_password_change check the profile themselves).
create function private.staff_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.active and not p.must_change_password
    and not private.is_anonymous()
$$;

-- Active staff whose session is complete: admins only after the second factor (aal2).
create function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.staff_role()
    when 'editor' then true
    when 'admin' then private.is_aal2()
    else false
  end
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_role() = 'admin' and private.is_aal2()
$$;

-- Raises unless the caller is active staff (optionally an admin); returns the user id.
-- Volatile on purpose: a function that raises must never be evaluated early by the planner.
create function private.require_staff(p_admin boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := private.staff_role();
begin
  if v_role is null then
    perform private.raise('unauthorized', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  end if;
  if v_role = 'admin' and not private.is_aal2() then
    perform private.raise('forbidden', 'Önce iki adımlı doğrulamayı tamamlayın.');
  end if;
  if p_admin and v_role <> 'admin' then
    perform private.raise('forbidden', 'Bu işlem için yönetici yetkisi gerekiyor.');
  end if;
  return auth.uid();
end;
$$;

-- The anonymous device of the Kâşif app (its auth user id), or an error.
create function private.require_device()
returns uuid
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_anonymous() then
    perform private.raise('unauthorized', 'Cihaz oturumu bulunamadı. Uygulamayı yeniden açın.');
  end if;
  return auth.uid();
end;
$$;

-- Members linked to the calling device.
create function private.device_explorer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.explorer_id
  from public.explorer_devices d
  where d.device_uid = auth.uid() and private.is_anonymous()
$$;

-- ---------------------------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------------------------

create function private.audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_meta jsonb default '{}',
  p_actor uuid default auth.uid()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (p_actor, p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'))
$$;

-- ---------------------------------------------------------------------------------------------
-- Failed-attempt locks (Kâşif kodu, centre PIN and setup code, current password)
-- Failures count for 15 minutes from the first one; the 5th locks the bucket for 15 minutes from
-- that failure. Same rule as the mock backend.
-- ---------------------------------------------------------------------------------------------

-- Serialises the attempts of one subject (device, user) in one bucket for this transaction, so
-- parallel guesses cannot race the failure counter.
create function private.lock_attempts(p_bucket text, p_subject text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_subject, 0))
$$;

create function private.attempt_locked(p_bucket text, p_subject text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rate_limit_counters c
    where c.bucket = p_bucket and c.subject = p_subject
      and c.count >= 5 and c.window_start > now() - interval '15 minutes'
  )
$$;

-- Records a failure; returns how many attempts are left (0 = now locked).
create function private.record_failure(p_bucket text, p_subject text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.rate_limit_counters;
  v_failures integer;
begin
  select * into v_row from public.rate_limit_counters c
  where c.bucket = p_bucket and c.subject = p_subject
  for update;
  if v_row.bucket is null or v_row.window_start <= now() - interval '15 minutes' then
    v_failures := 1;
  else
    v_failures := v_row.count + 1;
  end if;
  delete from public.rate_limit_counters c where c.bucket = p_bucket and c.subject = p_subject;
  insert into public.rate_limit_counters (bucket, subject, window_start, count)
  values (
    p_bucket,
    p_subject,
    case when v_failures = 1 or v_failures >= 5 then now() else v_row.window_start end,
    v_failures
  );
  return greatest(0, 5 - v_failures);
end;
$$;

create function private.clear_failures(p_bucket text, p_subject text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limit_counters c where c.bucket = p_bucket and c.subject = p_subject
$$;

create function private.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_text, 'UTF8'), 'sha256'), 'hex')
$$;

-- Random Crockford base32 (no I, L, O, U), like entities/explorer/codes.ts.
create function private.random_code(p_length integer)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (get_byte(b.bytes, i) % 32) + 1, 1), ''
    order by i
  )
  from (select extensions.gen_random_bytes(p_length) as bytes) b,
    generate_series(0, p_length - 1) as i
$$;

-- ---------------------------------------------------------------------------------------------
-- Read access (RLS). Writes have no policies: they go through the RPCs of later migrations.
-- ---------------------------------------------------------------------------------------------

-- Policies run as the caller: the helpers they use must be executable by `authenticated`.
grant execute on function
  private.is_anonymous(),
  private.is_aal2(),
  private.staff_role(),
  private.is_active_staff(),
  private.is_admin(),
  private.device_explorer_ids()
to authenticated;

alter table public.profiles enable row level security;
alter table public.kits enable row level security;
alter table public.qr_prefix_reservations enable row level security;
alter table public.kit_versions enable row level security;
alter table public.qr_codes enable row level security;
alter table public.publish_state enable row level security;
alter table public.media_assets enable row level security;
alter table public.explorers enable row level security;
alter table public.explorer_secrets enable row level security;
alter table public.explorer_devices enable row level security;
alter table public.explorer_events enable row level security;
alter table public.explorer_kit_progress enable row level security;
alter table public.explorer_badges enable row level security;
alter table public.center_devices enable row level security;
alter table public.app_settings enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.ai_usage enable row level security;
alter table public.audit_log enable row level security;

grant select on
  public.profiles,
  public.kits,
  public.kit_versions,
  public.qr_codes,
  public.media_assets,
  public.explorers,
  public.explorer_devices,
  public.explorer_events,
  public.explorer_kit_progress,
  public.explorer_badges,
  public.app_settings,
  public.ai_usage,
  public.audit_log
to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin());

create policy kits_read on public.kits for select to authenticated
  using (private.is_active_staff());
create policy kit_versions_read on public.kit_versions for select to authenticated
  using (private.is_active_staff());
create policy qr_codes_read on public.qr_codes for select to authenticated
  using (private.is_active_staff());
create policy media_read on public.media_assets for select to authenticated
  using (private.is_active_staff());
create policy app_settings_read on public.app_settings for select to authenticated
  using (private.is_active_staff());

create policy explorers_read on public.explorers for select to authenticated
  using (private.is_admin() or id in (select private.device_explorer_ids()));
create policy explorer_devices_read on public.explorer_devices for select to authenticated
  using (private.is_admin() or (device_uid = auth.uid() and private.is_anonymous()));
create policy explorer_events_read on public.explorer_events for select to authenticated
  using (private.is_admin());
create policy progress_read on public.explorer_kit_progress for select to authenticated
  using (private.is_admin() or explorer_id in (select private.device_explorer_ids()));
create policy badges_read on public.explorer_badges for select to authenticated
  using (private.is_admin() or explorer_id in (select private.device_explorer_ids()));

-- Never the PIN or setup-code hashes (CenterDeviceSummary in the settings feature).
grant select (id, label, setup_expires_at, device_uid, activated_at, revoked_at, created_by, created_at)
  on public.center_devices to authenticated;
create policy center_devices_read on public.center_devices for select to authenticated
  using (private.is_admin());
create policy ai_usage_read on public.ai_usage for select to authenticated
  using (private.is_admin() or (user_id = auth.uid() and private.is_active_staff()));
create policy audit_log_read on public.audit_log for select to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- Public probes
-- ---------------------------------------------------------------------------------------------

-- Keep-alive (the Free plan pauses after 7 idle days).
create function public.ping()
returns text
language sql
stable
set search_path = ''
as $$ select 'pong'::text $$;

grant execute on function public.ping() to anon, authenticated;
