-- AI quota (ADR 0018): the counters behind the Studio's AI assistance, from `ai_usage`. Same rules
-- as the mock adapter (features/ai-studio/api/ai.mock.ts):
--   * only successful generations (status 'ok') count; blocked and failed attempts do not
--   * days are Europe/Istanbul days; the quota resets at the next Istanbul midnight
--   * the result is jsonb in the camelCase shape of AiQuota (features/ai-studio/api/port.ts)
-- The ai-generate Edge Function calls ai_quota() with the caller's own JWT (so only active staff
-- get past it) and writes `ai_usage` rows with the service role.

-- The quota of any Studio user: for the ai-generate function (service role) only.
create function public.ai_quota_for(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_start timestamptz := v_today::timestamp at time zone 'Europe/Istanbul';
  v_end timestamptz := (v_today + 1)::timestamp at time zone 'Europe/Istanbul';
  v_user_used integer;
  v_project_used integer;
begin
  select s.value into v_settings from public.app_settings s where s.id = 1;
  select count(*) filter (where a.user_id = p_user), count(*)
  into v_user_used, v_project_used
  from public.ai_usage a
  where a.status = 'ok' and a.created_at >= v_start and a.created_at < v_end;
  return jsonb_build_object(
    'provider', coalesce(v_settings ->> 'aiProvider', 'off'),
    'userUsed', v_user_used,
    'userLimit', coalesce((v_settings ->> 'aiDailyUserLimit')::integer, 0),
    'projectUsed', v_project_used,
    'projectLimit', coalesce((v_settings ->> 'aiDailyProjectLimit')::integer, 0),
    'suggestionCount', coalesce((v_settings ->> 'aiSuggestionCount')::integer, 1),
    -- Date#toISOString() of the next Istanbul midnight, like the mock.
    'resetsAt', to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- The signed-in Studio user's quota; raises for everyone else (devices, inactive staff, admins
-- without TOTP), which is how ai-generate checks its caller.
create function public.ai_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
begin
  return public.ai_quota_for(v_user);
end;
$$;

-- Reserves one generation before the provider is called (ai-generate, service role): under a
-- lock, today's successful and in-flight generations are counted against the limits, so parallel
-- requests cannot exceed them together. Returns the ai_usage row the function completes later.
-- A reservation older than 5 minutes (a crashed function) no longer counts.
create function public.ai_reserve(p_user uuid, p_kind text, p_provider text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_start timestamptz := v_today::timestamp at time zone 'Europe/Istanbul';
  v_end timestamptz := (v_today + 1)::timestamp at time zone 'Europe/Istanbul';
  v_user_used integer;
  v_project_used integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('kasif:ai-quota', 0));
  select s.value into v_settings from public.app_settings s where s.id = 1;
  select count(*) filter (where a.user_id = p_user), count(*)
  into v_user_used, v_project_used
  from public.ai_usage a
  where a.created_at >= v_start and a.created_at < v_end
    and (a.status = 'ok' or (a.status = 'pending' and a.created_at > now() - interval '5 minutes'));
  if v_user_used >= coalesce((v_settings ->> 'aiDailyUserLimit')::integer, 0)
    or v_project_used >= coalesce((v_settings ->> 'aiDailyProjectLimit')::integer, 0) then
    perform private.raise('quota',
      'Bugünkü ücretsiz yapay zekâ kotası doldu. Kota gece 00:00’da (İstanbul) yenilenir.',
      jsonb_build_object(
        'resetsAt', to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ));
  end if;
  insert into public.ai_usage (user_id, kind, status, provider, model)
  values (p_user, p_kind, 'pending', p_provider, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ai_reserve(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, text, text) to service_role;
revoke all on function public.ai_quota_for(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_for(uuid) to service_role;
grant execute on function public.ai_quota() to authenticated;
