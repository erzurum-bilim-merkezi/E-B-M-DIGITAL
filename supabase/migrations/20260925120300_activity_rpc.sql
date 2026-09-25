-- Activity: record_events (the offline queue flushes here), progress reset. Same rules as the mock
-- adapter (src/features/activity/api/activity.mock.ts) and entities/activity:
--   * ≤ 50 events per call, ≤ 120 events per device and minute
--   * idempotent by client_event_id; events older than 7 days are rejected, future ones clamped
--   * the member must be linked to this device; kit/card ids must be in the QR registry
--   * badge_earned comes only from the server; progress and badges are updated in the same call

-- Shape of one client event (the app validates with Zod first; this is the server copy).
create function private.event_is_valid(p_event jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_type text := p_event ->> 'type';
  v_data jsonb := p_event -> 'data';
begin
  -- "is distinct from": a missing field (NULL) must fail the check, not slip through it.
  if jsonb_typeof(p_event) is distinct from 'object' or jsonb_typeof(v_data) is distinct from 'object' then
    return false;
  end if;
  if v_type is null or v_type not in ('qr_scan', 'kit_open', 'card_open', 'card_complete',
    'quiz_answer', 'kit_complete', 'badge_earned', 'certificate_view') then
    return false;
  end if;
  if jsonb_typeof(p_event -> 'isPreview') is distinct from 'boolean' then return false; end if;
  begin
    perform (p_event ->> 'clientEventId')::uuid, (p_event ->> 'explorerId')::uuid,
      (p_event ->> 'occurredAt')::timestamptz;
    if jsonb_typeof(p_event -> 'kitId') is distinct from 'null' then
      perform (p_event ->> 'kitId')::uuid;
    end if;
  exception when others then
    return false;
  end;
  if p_event ->> 'clientEventId' is null or p_event ->> 'explorerId' is null
    or p_event ->> 'occurredAt' is null then
    return false;
  end if;
  if coalesce(jsonb_typeof(p_event -> 'stepId'), '') not in ('null', 'string')
    or char_length(coalesce(p_event ->> 'stepId', '')) > 40 then
    return false;
  end if;
  return case v_type
    when 'qr_scan' then
      jsonb_typeof(v_data -> 'code') = 'string' and char_length(v_data ->> 'code') <= 12
      and v_data ->> 'source' in ('camera-link', 'in-app', 'manual')
    when 'card_complete' then
      jsonb_typeof(v_data -> 'durationMs') = 'number'
      and (v_data ->> 'durationMs')::numeric between 0 and 21600000
      and jsonb_typeof(v_data -> 'attempts') = 'number'
      and (v_data ->> 'attempts')::numeric between 0 and 1000
    when 'quiz_answer' then
      jsonb_typeof(v_data -> 'correct') = 'boolean'
      and jsonb_typeof(v_data -> 'optionId') = 'string' and char_length(v_data ->> 'optionId') <= 40
    when 'kit_complete' then
      jsonb_typeof(v_data -> 'durationMs') = 'number'
      and (v_data ->> 'durationMs')::numeric between 0 and 21600000
    when 'badge_earned' then
      jsonb_typeof(v_data -> 'badgeId') = 'string' and char_length(v_data ->> 'badgeId') <= 80
    else true
  end;
end;
$$;

-- What is stored of an event's data: only the validated fields of its type (never extra keys
-- a client might send).
create function private.event_data(p_type text, p_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'qr_scan' then jsonb_build_object('code', p_data -> 'code', 'source', p_data -> 'source')
    when 'card_complete' then
      jsonb_build_object('durationMs', p_data -> 'durationMs', 'attempts', p_data -> 'attempts')
    when 'quiz_answer' then
      jsonb_build_object('correct', p_data -> 'correct', 'optionId', p_data -> 'optionId')
    when 'kit_complete' then jsonb_build_object('durationMs', p_data -> 'durationMs')
    when 'badge_earned' then jsonb_build_object('badgeId', p_data -> 'badgeId')
    else '{}'::jsonb
  end
$$;

create function private.badge_json(p_badge public.explorer_badges)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'explorerId', p_badge.explorer_id,
    'badgeId', p_badge.badge_id,
    'kitId', p_badge.kit_id,
    'earnedAt', p_badge.earned_at
  )
$$;

create function public.record_events(p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_count integer;
  v_window timestamptz := date_trunc('minute', now());
  v_used integer;
  v_event jsonb;
  v_type public.activity_type;
  v_explorer uuid;
  v_kit uuid;
  v_step text;
  v_at timestamptz;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_rejected integer := 0;
  v_new_badges jsonb := '[]';
  v_badge public.explorer_badges;
  v_touched jsonb := '{}';
  v_counters record;
  v_earned text[];
  v_global text;
  v_preview boolean;
begin
  if jsonb_typeof(p_events) <> 'array' then
    perform private.raise('validation', 'Olay paketi geçersiz.');
  end if;
  v_count := jsonb_array_length(p_events);
  -- 50 real events are a few kB; anything far larger is not the app talking.
  if v_count < 1 or v_count > 50 or octet_length(p_events::text) > 65536 then
    perform private.raise('validation', 'Olay paketi geçersiz.');
  end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    if not private.event_is_valid(v_event) then
      perform private.raise('validation', 'Olay paketi geçersiz.');
    end if;
  end loop;

  -- Rate limit per device and minute (the whole batch counts).
  select c.count into v_used from public.rate_limit_counters c
  where c.bucket = 'events' and c.subject = v_device::text and c.window_start = v_window
  for update;
  if coalesce(v_used, 0) + v_count > 120 then
    perform private.raise('rate_limited', 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.');
  end if;
  insert into public.rate_limit_counters (bucket, subject, window_start, count)
  values ('events', v_device::text, v_window, v_count)
  on conflict (bucket, subject, window_start)
  do update set count = public.rate_limit_counters.count + excluded.count;

  for v_event in select value from jsonb_array_elements(p_events) loop
    if exists (
      select 1 from public.explorer_events e
      where e.client_event_id = (v_event ->> 'clientEventId')::uuid
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    v_type := (v_event ->> 'type')::public.activity_type;
    v_explorer := (v_event ->> 'explorerId')::uuid;
    v_kit := nullif(v_event ->> 'kitId', '')::uuid;
    v_step := v_event ->> 'stepId';
    v_at := least((v_event ->> 'occurredAt')::timestamptz, now() + interval '5 minutes');

    if v_type = 'badge_earned'
      or v_at < now() - interval '7 days'
      or not exists (
        select 1 from public.explorer_devices d
        where d.explorer_id = v_explorer and d.device_uid = v_device
      )
      -- Kit and card ids must belong to a published kit (they are in the QR registry).
      or v_kit is null
      or not exists (select 1 from public.qr_codes q where q.kit_id = v_kit)
      or (v_step is not null and not exists (
        select 1 from public.qr_codes q where q.kit_id = v_kit and q.step_id = v_step
      ))
    then
      v_rejected := v_rejected + 1;
      continue;
    end if;

    insert into public.explorer_events
      (client_event_id, explorer_id, kit_id, step_id, type, data, is_preview, occurred_at)
    values (
      (v_event ->> 'clientEventId')::uuid, v_explorer, v_kit, v_step, v_type,
      private.event_data(v_type::text, v_event -> 'data'), (v_event ->> 'isPreview')::boolean, v_at
    );
    v_accepted := v_accepted + 1;

    -- Progress of this member in this kit.
    insert into public.explorer_kit_progress (explorer_id, kit_id, started_at)
    values (v_explorer, v_kit, v_at)
    on conflict (explorer_id, kit_id)
    do update set started_at = least(public.explorer_kit_progress.started_at, excluded.started_at);

    if v_type = 'card_complete' then
      update public.explorer_kit_progress p set
        completed_steps = case when v_step is null or v_step = any (p.completed_steps)
          then p.completed_steps else p.completed_steps || v_step end,
        total_duration_ms = p.total_duration_ms + (v_event -> 'data' ->> 'durationMs')::bigint
      where p.explorer_id = v_explorer and p.kit_id = v_kit;
    elsif v_type = 'qr_scan' then
      update public.explorer_kit_progress p set qr_scans = p.qr_scans + 1
      where p.explorer_id = v_explorer and p.kit_id = v_kit;
    elsif v_type = 'kit_complete' then
      update public.explorer_kit_progress p set completed_at = coalesce(p.completed_at, v_at)
      where p.explorer_id = v_explorer and p.kit_id = v_kit;
      insert into public.explorer_badges (explorer_id, badge_id, kit_id, earned_at)
      values (v_explorer, 'kit:' || v_kit::text, v_kit, v_at)
      on conflict (explorer_id, badge_id) do nothing
      returning * into v_badge;
      if v_badge.badge_id is not null then
        v_new_badges := v_new_badges || private.badge_json(v_badge);
        v_badge := null;
      end if;
    end if;

    v_touched := v_touched || jsonb_build_object(
      v_explorer::text,
      jsonb_build_object('at', v_at, 'preview', (v_event ->> 'isPreview')::boolean)
    );
  end loop;

  -- Global badges and last-seen of every member that got new events.
  for v_explorer, v_at, v_preview in
    select key::uuid, (value ->> 'at')::timestamptz, (value ->> 'preview')::boolean
    from jsonb_each(v_touched)
  loop
    select
      (select count(*) from public.explorer_events e
        where e.explorer_id = v_explorer and e.type = 'qr_scan') as qr_scans,
      (select count(*) from public.explorer_kit_progress p
        where p.explorer_id = v_explorer and p.completed_at is not null) as completed_kits,
      (select count(distinct coalesce(e.kit_id::text, '') || ':' || coalesce(e.step_id, ''))
        from public.explorer_events e
        where e.explorer_id = v_explorer and e.type = 'quiz_answer'
          and (e.data ->> 'correct')::boolean) as correct_answers
    into v_counters;
    select coalesce(array_agg(b.badge_id), '{}') into v_earned
    from public.explorer_badges b where b.explorer_id = v_explorer;

    for v_global in
      select id from (values
        ('first-qr', v_counters.qr_scans >= 1),
        ('science-explorer', v_counters.completed_kits >= 3),
        ('quiz-master', v_counters.correct_answers >= 5)
      ) as rules (id, earned)
      where rules.earned and not (rules.id = any (v_earned))
    loop
      insert into public.explorer_badges (explorer_id, badge_id, kit_id, earned_at)
      values (v_explorer, v_global, null, v_at)
      returning * into v_badge;
      v_new_badges := v_new_badges || private.badge_json(v_badge);
    end loop;

    update public.explorers e set last_seen_at = now() where e.id = v_explorer;

    -- Server-side badge events for the admin timeline.
    insert into public.explorer_events
      (client_event_id, explorer_id, kit_id, step_id, type, data, is_preview, occurred_at)
    select gen_random_uuid(), v_explorer, nullif(b ->> 'kitId', '')::uuid, null, 'badge_earned',
      jsonb_build_object('badgeId', b ->> 'badgeId'), v_preview, (b ->> 'earnedAt')::timestamptz
    from jsonb_array_elements(v_new_badges) b
    where (b ->> 'explorerId')::uuid = v_explorer;
  end loop;

  return jsonb_build_object(
    'accepted', v_accepted,
    'duplicates', v_duplicates,
    'rejected', v_rejected,
    'newBadges', v_new_badges
  );
end;
$$;

-- "Baştan başla": clears the ✓ marks of one kit; badges stay.
create function public.reset_kit_progress(p_explorer uuid, p_kit uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_linked(p_explorer);
  update public.explorer_kit_progress p set
    completed_steps = '{}',
    completed_at = null,
    total_duration_ms = 0
  where p.explorer_id = p_explorer and p.kit_id = p_kit;
end;
$$;

grant execute on function
  public.record_events(jsonb),
  public.reset_kit_progress(uuid, uuid)
to authenticated;
