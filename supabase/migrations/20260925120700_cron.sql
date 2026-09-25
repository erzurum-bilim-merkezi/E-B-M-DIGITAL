-- Retention (ADR 0012, 0017 — KVKK): a daily job removes data the platform no longer needs.
-- Periods follow app_settings (rawEventRetentionDays, inactiveExplorerMonths).

do $$
begin
  -- Where the Supabase dashboard puts it too (PGlite in the unit tests has no pg_cron: stubbed).
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
end;
$$;

create function private.daily_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb := (select s.value from public.app_settings s where s.id = 1);
  v_events integer;
  v_previews integer;
  v_explorers integer;
  v_devices integer;
begin
  delete from public.explorer_events e
  where e.received_at < now() - make_interval(days => (v_settings ->> 'rawEventRetentionDays')::int);
  get diagnostics v_events = row_count;

  delete from public.explorer_events e
  where e.is_preview and e.received_at < now() - interval '24 hours';
  get diagnostics v_previews = row_count;

  -- Members inactive for the configured months, with everything they did (cascade).
  delete from public.explorers e
  where e.last_seen_at < now() - make_interval(months => (v_settings ->> 'inactiveExplorerMonths')::int);
  get diagnostics v_explorers = row_count;

  -- Anonymous device sessions that hold no member and were not used for 30 days.
  delete from auth.users u
  where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.explorer_devices d where d.device_uid = u.id)
    and not exists (select 1 from public.center_devices c where c.device_uid = u.id);
  get diagnostics v_devices = row_count;

  delete from public.audit_log a where a.at < now() - interval '180 days';
  delete from public.ai_usage a where a.created_at < now() - interval '90 days';
  delete from public.rate_limit_counters c where c.window_start < now() - interval '24 hours';
  update public.center_devices c set setup_code_hash = null
  where c.setup_code_hash is not null and c.setup_expires_at < now();

  return jsonb_build_object(
    'events', v_events, 'previews', v_previews, 'explorers', v_explorers, 'devices', v_devices
  );
end;
$$;

-- 03:17 Istanbul time (UTC+3).
select cron.schedule('kasif-daily-cleanup', '17 0 * * *', 'select private.daily_cleanup()');
