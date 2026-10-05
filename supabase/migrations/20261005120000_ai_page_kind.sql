-- Interactive pages (ADR 0023): the Studio's AI assistance drafts a self-contained three.js page
-- for an interactive-page card. ai-generate records those generations in ai_usage as kind 'page';
-- they count towards the same daily quota as every other kind, rejected ones included (below).

-- The inline check of 20260925120000_types_tables.sql, under the name Postgres gave it. No
-- "if exists": a database where the name differs must stop here, not keep the old list as well.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('scene', 'icon', 'text', 'kit', 'page'));

-- A page the model wrote but the page check rejected still cost up to 16 384 output tokens, and
-- the check rejects often: rejected page generations (kind 'page', status 'blocked') count towards
-- the daily quota like successful ones, so one account cannot drain the free tier for everyone.
-- Other kinds keep the rule of 20260925120900_ai.sql (only 'ok' counts). Same rule in the mock
-- adapter (features/ai-studio/api/ai.mock.ts). Bodies are otherwise those of that migration.
create or replace function public.ai_quota_for(p_user uuid)
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
  where (a.status = 'ok' or (a.kind = 'page' and a.status = 'blocked'))
    and a.created_at >= v_start and a.created_at < v_end;
  return jsonb_build_object(
    'provider', coalesce(v_settings ->> 'aiProvider', 'off'),
    'userUsed', v_user_used,
    'userLimit', coalesce((v_settings ->> 'aiDailyUserLimit')::integer, 0),
    'projectUsed', v_project_used,
    'projectLimit', coalesce((v_settings ->> 'aiDailyProjectLimit')::integer, 0),
    'suggestionCount', coalesce((v_settings ->> 'aiSuggestionCount')::integer, 1),
    'resetsAt', to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.ai_reserve(p_user uuid, p_kind text, p_provider text)
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
    and (a.status = 'ok'
      or (a.kind = 'page' and a.status = 'blocked')
      or (a.status = 'pending' and a.created_at > now() - interval '5 minutes'));
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

-- "create or replace" keeps the grants of 20260925120900_ai.sql; repeated so this file says so.
revoke all on function public.ai_reserve(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, text, text) to service_role;
revoke all on function public.ai_quota_for(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_for(uuid) to service_role;

-- RULE (20260925129900_schema_version.sql): every new migration redefines this function with its
-- own timestamp.
create or replace function public.schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20261005120000'::text $$;

revoke execute on function public.schema_version() from public;
grant execute on function public.schema_version() to anon, authenticated;
