-- Studio analytics (ADR 0012): the AnalyticsReader of features/analytics. Same numbers as the mock
-- adapter, whose computations live in src/features/analytics/api/compute.ts — the database tests
-- run both on the same rows and compare the results. Everything is computed here; the browser
-- never downloads raw events. Rules shared by every function:
--   * statistics ignore preview-device events; members whose events all come from preview
--     devices are not counted or listed
--   * days are Europe/Istanbul days; timestamps leave as JavaScript ISO strings (UTC, ms)
--   * editors see aggregates only; member-level data (names, timelines, exports) is admin-only
--   * results are jsonb in the camelCase shape of features/analytics/api/port.ts

-- Preview events are deleted after 24 hours, so this index stays tiny; it finds the members that
-- have preview events without scanning the live ones.
create index explorer_events_preview_idx on public.explorer_events (explorer_id) where is_preview;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- Date#toISOString() of the instant: the timestamp format of the mock adapters.
create function private.iso_time(p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- First instant of an Istanbul day. Ranges of days become [start(from), start(to + 1)), which
-- the (kit_id, occurred_at) and (occurred_at) indexes answer.
create function private.istanbul_day_start(p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_day::timestamp at time zone 'Europe/Istanbul'
$$;

-- String#trim(): every JavaScript white space and line terminator.
create function private.js_trim(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(p_text, E' \t\n\r\f\u000b ﻿                　')
$$;

-- toLocaleLowerCase('tr') for the letters of nicknames and display codes (entities/explorer):
-- I → ı and İ → i, and the Turkish capitals mapped explicitly so no database locale matters.
create function private.tr_lower(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(p_text, 'IİÇĞÖŞÜÂÎÛ', 'ıiçğöşüâîû'))
$$;

-- Name and emoji of the global badges (GLOBAL_BADGES in entities/explorer); null for others.
create function private.global_badge(p_badge_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_badge_id
    when 'first-qr' then jsonb_build_object('name', 'İlk QR’ım', 'emoji', '📷')
    when 'science-explorer' then jsonb_build_object('name', 'Bilim Kâşifi', 'emoji', '🔭')
    when 'quiz-master' then jsonb_build_object('name', 'Quiz Ustası', 'emoji', '🧠')
  end
$$;

-- Display data of every kit (kitInfos() in compute.ts): its document is the latest finalized
-- version, or the draft of a never-published kit; a non-empty draft title wins.
create function private.analytics_kits()
returns table (kit_id uuid, title text, document jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id,
    coalesce(nullif(k.draft ->> 'title', ''), coalesce(v.document, k.draft) ->> 'title'),
    coalesce(v.document, k.draft),
    k.created_at
  from public.kits k
  left join lateral (
    select kv.document from public.kit_versions kv
    where kv.kit_id = k.id and kv.finalized_at is not null
    order by kv.version desc
    limit 1
  ) v on true
$$;

-- Card title and code by kit and card id: draft cards win, cards removed from the draft keep
-- their title from the kit's document.
create function private.analytics_steps()
returns table (kit_id uuid, step_id text, title text, code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (s.kit_id, s.step_id) s.kit_id, s.step_id, s.title, s.code
  from (
    select k.kit_id, st.value ->> 'id' as step_id, st.value ->> 'title' as title,
      st.value ->> 'qrCode' as code, 0 as layer, st.ord
    from private.analytics_kits() k
    cross join lateral jsonb_array_elements(k.document -> 'steps') with ordinality as st (value, ord)
    union all
    select k.id, st.value ->> 'id', st.value ->> 'title', st.value ->> 'qrCode', 1, st.ord
    from public.kits k
    cross join lateral jsonb_array_elements(k.draft -> 'steps') with ordinality as st (value, ord)
  ) s
  where s.step_id is not null
  order by s.kit_id, s.step_id, s.layer desc, s.ord desc
$$;

-- Members whose events all come from preview devices (staff trying a kit). Members without any
-- event are real members.
create function private.preview_only_explorers()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.explorer_id
  from public.explorer_events e
  where e.is_preview
    and not exists (
      select 1 from public.explorer_events l where l.explorer_id = e.explorer_id and not l.is_preview
    )
$$;

-- Activity rows as FeedItem, in the order of p_ids (toFeedItem() in compute.ts). Members are
-- named only when p_named (admins).
create function private.feed_items(p_ids bigint[], p_named boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with kits as materialized (
    select * from private.analytics_kits()
  ),
  steps as materialized (
    select * from private.analytics_steps()
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'at', private.iso_time(e.occurred_at),
    'type', e.type,
    'explorer', case when p_named and x.id is not null then jsonb_build_object(
      'id', x.id, 'nickname', x.nickname, 'displayCode', x.display_code, 'avatar', x.avatar
    ) end,
    'kitTitle', k.title,
    'stepTitle', s.title,
    'code', case when e.type = 'qr_scan' then e.data -> 'code' else to_jsonb(s.code) end,
    'source', case when e.type = 'qr_scan' then e.data -> 'source' end,
    'durationMs', case when e.type in ('card_complete', 'kit_complete') then e.data -> 'durationMs' end,
    'correct', case when e.type = 'quiz_answer' then e.data -> 'correct' end,
    'badgeName', case when e.type = 'badge_earned' then coalesce(
      private.global_badge(e.data ->> 'badgeId') ->> 'name',
      b.document -> 'badge' ->> 'name',
      'Kit rozeti'
    ) end
  ) order by i.ord), '[]')
  from unnest(p_ids) with ordinality as i (id, ord)
  join public.explorer_events e on e.id = i.id
  left join public.explorers x on x.id = e.explorer_id
  left join kits k on k.kit_id = e.kit_id
  left join steps s on s.kit_id = e.kit_id and s.step_id = nullif(e.step_id, '')
  left join kits b on e.type = 'badge_earned'
    and starts_with(e.data ->> 'badgeId', 'kit:')
    and b.kit_id::text = substr(e.data ->> 'badgeId', 5)
$$;

-- ExplorerRow of a member (explorerRows() in compute.ts).
create function private.explorer_row(p_explorer public.explorers)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_explorer.id,
    'nickname', p_explorer.nickname,
    'displayCode', p_explorer.display_code,
    'avatar', p_explorer.avatar,
    'createdAt', private.iso_time(p_explorer.created_at),
    'lastSeenAt', private.iso_time(p_explorer.last_seen_at),
    'createdVia', p_explorer.created_via,
    'kitsStarted', (
      select count(*) from public.explorer_kit_progress p where p.explorer_id = p_explorer.id
    ),
    'kitsCompleted', (
      select count(*) from public.explorer_kit_progress p
      where p.explorer_id = p_explorer.id and p.completed_at is not null
    ),
    'badges', (select count(*) from public.explorer_badges b where b.explorer_id = p_explorer.id),
    'qrScans', (
      select count(*) from public.explorer_events e
      where e.explorer_id = p_explorer.id and e.type = 'qr_scan' and not e.is_preview
    ),
    'devices', (select count(*) from public.explorer_devices d where d.explorer_id = p_explorer.id)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- Studio home: KPIs, 30-day trend, most scanned cards, live feed (named for admins), per-kit
-- summary and totals.
create function public.analytics_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_named boolean;
  v_today date;
  v_result jsonb;
begin
  perform private.require_staff();
  v_named := private.staff_role() = 'admin';
  v_today := (now() at time zone 'Europe/Istanbul')::date;

  with live as (
    select e.id, e.explorer_id, e.kit_id, nullif(e.step_id, '') as step_id, e.type, e.occurred_at,
      (e.occurred_at at time zone 'Europe/Istanbul')::date as day
    from public.explorer_events e
    where not e.is_preview
  ),
  kits as materialized (
    select * from private.analytics_kits()
  ),
  steps as materialized (
    select * from private.analytics_steps()
  ),
  members as (
    select x.created_at from public.explorers x
    where x.id not in (select p.id from private.preview_only_explorers() as p (id))
  ),
  kpis as (
    select
      count(distinct l.explorer_id) filter (where l.day = v_today) as active_today,
      count(distinct l.explorer_id)
        filter (where l.occurred_at >= now() - interval '15 minutes') as active_15m,
      count(*) filter (where l.type = 'qr_scan' and l.day = v_today) as qr_today,
      count(*) filter (
        where l.type = 'kit_complete' and l.kit_id is not null
          and l.day between v_today - 6 and v_today
      ) as completed_week,
      count(distinct l.explorer_id)
        filter (where l.occurred_at >= now() - interval '720 hours') as monthly,
      count(*) as events
    from live l
  ),
  trend as (
    select d.day, count(distinct l.explorer_id) as active,
      count(l.id) filter (where l.type = 'qr_scan') as qr
    from (select v_today - o as day from generate_series(0, 29) as o) d
    left join live l on l.day = d.day
    group by d.day
  ),
  -- Equal counts keep the order of each card's first scan.
  top_cards as (
    select l.kit_id, l.step_id, count(*) as scans, min(l.id) as first_id
    from live l
    where l.type = 'qr_scan' and l.kit_id is not null and l.step_id is not null
    group by l.kit_id, l.step_id
    order by scans desc, first_id
    limit 6
  ),
  per_kit as (
    select l.kit_id,
      count(*) filter (
        where l.type = 'qr_scan' and l.day between v_today - 6 and v_today
      ) as scans7d,
      count(distinct l.explorer_id) filter (where l.type in ('kit_open', 'card_open')) as starts,
      count(distinct l.explorer_id) filter (where l.type = 'kit_complete') as completions
    from live l
    where l.kit_id is not null and l.type in ('qr_scan', 'kit_open', 'card_open', 'kit_complete')
    group by l.kit_id
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'activeToday', k.active_today,
        'activeLast15m', k.active_15m,
        'qrScansToday', k.qr_today,
        'kitsCompletedThisWeek', k.completed_week,
        'newExplorersToday', (
          select count(*) from members m
          where (m.created_at at time zone 'Europe/Istanbul')::date = v_today
        ),
        'monthlyActive', k.monthly
      )
      from kpis k
    ),
    'trend', (
      select jsonb_agg(jsonb_build_object(
        'day', t.day, 'activeExplorers', t.active, 'qrScans', t.qr
      ) order by t.day)
      from trend t
    ),
    'topCards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kitId', c.kit_id,
        'kitTitle', coalesce(k.title, 'Silinmiş kit'),
        'stepId', c.step_id,
        'stepTitle', coalesce(s.title, 'Silinmiş kart'),
        'code', coalesce(s.code, ''),
        'scans', c.scans
      ) order by c.scans desc, c.first_id)
      from top_cards c
      left join kits k on k.kit_id = c.kit_id
      left join steps s on s.kit_id = c.kit_id and s.step_id = c.step_id
    ), '[]'),
    'feed', private.feed_items(array(
      select e.id from public.explorer_events e
      where not e.is_preview
      order by e.occurred_at desc, e.id desc
      limit 25
    ), v_named),
    'perKit', coalesce((
      select jsonb_object_agg(p.kit_id::text, jsonb_build_object(
        'scans7d', p.scans7d,
        'starts', p.starts,
        'completions', p.completions,
        'completionRate', case when p.starts > 0 then p.completions::float8 / p.starts else 0 end
      ))
      from per_kit p
    ), '{}'),
    'totals', jsonb_build_object(
      'explorers', (select count(*) from members),
      'events', (select k.events from kpis k)
    )
  )
  into v_result;
  return v_result;
end;
$$;

-- One kit for a range of Istanbul days: funnel, scan sources, quiz, drop-off, heatmap, trend.
create function public.analytics_kit_stats(p_kit uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_document jsonb;
  v_result jsonb;
begin
  perform private.require_staff();
  select k.document into v_document from private.analytics_kits() k where k.kit_id = p_kit;
  if not found then
    perform private.raise('not_found', 'Kit bulunamadı.');
  end if;

  with ev as (
    select e.explorer_id, e.step_id, e.type, e.data,
      e.occurred_at at time zone 'Europe/Istanbul' as local_time
    from public.explorer_events e
    where e.kit_id = p_kit and not e.is_preview
      and e.occurred_at >= private.istanbul_day_start(p_from)
      and e.occurred_at < private.istanbul_day_start(p_to + 1)
  ),
  steps as (
    select st.value ->> 'id' as step_id, st.value ->> 'title' as title,
      st.value ->> 'qrCode' as code, st.value ->> 'type' as type, st.ord
    from jsonb_array_elements(v_document -> 'steps') with ordinality as st (value, ord)
  ),
  per_step as (
    select s.ord, s.step_id, s.title, s.code, s.type,
      count(distinct e.explorer_id) filter (where e.type = 'card_open') as opens,
      count(distinct e.explorer_id) filter (where e.type = 'card_complete') as completes,
      coalesce(round(avg((e.data ->> 'durationMs')::numeric)
        filter (where e.type = 'card_complete')), 0) as avg_duration,
      count(*) filter (where e.type = 'quiz_answer' and (e.data ->> 'correct')::boolean) as correct,
      count(*) filter (where e.type = 'quiz_answer') as total,
      count(*) filter (where e.type = 'qr_scan' and e.data ->> 'source' = 'camera-link') as camera,
      count(*) filter (where e.type = 'qr_scan' and e.data ->> 'source' = 'in-app') as in_app,
      count(*) filter (
        where e.type = 'qr_scan' and coalesce(e.data ->> 'source', '') not in ('camera-link', 'in-app')
      ) as manual
    from steps s
    left join ev e on e.step_id = s.step_id
    group by s.ord, s.step_id, s.title, s.code, s.type
  ),
  totals as (
    select
      count(distinct e.explorer_id) filter (where e.type in ('kit_open', 'card_open')) as opens,
      count(distinct e.explorer_id) filter (where e.type = 'kit_complete') as completions,
      count(*) filter (where e.type = 'qr_scan') as scans,
      coalesce(round(avg((e.data ->> 'durationMs')::numeric)
        filter (where e.type = 'kit_complete')), 0) as avg_duration,
      -- Kit-code scans have no card.
      count(*) filter (
        where e.type = 'qr_scan' and e.step_id is null and e.data ->> 'source' = 'camera-link'
      ) as camera,
      count(*) filter (
        where e.type = 'qr_scan' and e.step_id is null and e.data ->> 'source' = 'in-app'
      ) as in_app,
      count(*) filter (
        where e.type = 'qr_scan' and e.step_id is null
          and coalesce(e.data ->> 'source', '') not in ('camera-link', 'in-app')
      ) as manual
    from ev e
  ),
  heat as (
    select extract(isodow from e.local_time)::integer - 1 as weekday,
      extract(hour from e.local_time)::integer as hour, count(*) as events
    from ev e
    group by 1, 2
  ),
  trend as (
    select d.day,
      count(*) filter (where e.type = 'card_open') as opens,
      count(*) filter (where e.type = 'card_complete') as completes
    from (select p_from + o as day from generate_series(0, least(p_to - p_from, 399)) as o) d
    left join ev e on e.local_time::date = d.day
    group by d.day
  ),
  -- Equal drop rates keep the card order.
  dropped as (
    select p.step_id, p.title, 1 - p.completes::float8 / p.opens as drop_rate
    from per_step p
    where p.opens >= 1
    order by drop_rate desc, p.ord
    limit 1
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'opens', t.opens,
        'starts', t.opens,
        'completions', t.completions,
        'scans', t.scans,
        'avgKitDurationMs', t.avg_duration
      )
      from totals t
    ),
    'funnel', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stepId', p.step_id,
        'title', p.title,
        'code', p.code,
        'opens', p.opens,
        'completes', p.completes,
        'avgDurationMs', p.avg_duration
      ) order by p.ord)
      from per_step p
    ), '[]'),
    'scansBySource', (
      select jsonb_build_array(jsonb_build_object(
        'code', v_document ->> 'qrPrefix',
        'title', 'Kit kodu',
        'camera', t.camera,
        'inApp', t.in_app,
        'manual', t.manual
      ))
      from totals t
    ) || coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code, 'title', p.title, 'camera', p.camera, 'inApp', p.in_app, 'manual', p.manual
      ) order by p.ord)
      from per_step p
    ), '[]'),
    'quiz', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stepId', p.step_id, 'title', p.title, 'correct', p.correct, 'total', p.total
      ) order by p.ord)
      from per_step p
      where p.type = 'quiz'
    ), '[]'),
    'mostDropped', (
      select jsonb_build_object('stepId', d.step_id, 'title', d.title, 'dropRate', d.drop_rate)
      from dropped d
      where d.drop_rate > 0
    ),
    -- [weekday 0 = Monday][hour 0–23]
    'heatmap', (
      select jsonb_agg(r.hours order by r.weekday)
      from (
        select w.weekday, jsonb_agg(coalesce(h.events, 0) order by hr.hour) as hours
        from generate_series(0, 6) as w (weekday)
        cross join generate_series(0, 23) as hr (hour)
        left join heat h on h.weekday = w.weekday and h.hour = hr.hour
        group by w.weekday
      ) r
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', t.day, 'opens', t.opens, 'completes', t.completes
      ) order by t.day)
      from trend t
    ), '[]')
  )
  into v_result;
  return v_result;
end;
$$;

-- One page of the member list (ExplorerFilter), most recently seen first. Search matches the
-- nickname (Turkish case folding) or the display code ("#A7F2").
create function public.analytics_explorers(
  p_query text default '',
  p_page integer default 1,
  p_page_size integer default 20,
  p_kit text default 'all',
  p_completed text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_needle text := private.tr_lower(private.js_trim(coalesce(p_query, '')));
  v_kit text := coalesce(p_kit, 'all');
  v_completed text := coalesce(p_completed, 'all');
  v_ids uuid[];
  v_total integer;
  v_page_count integer;
  v_page integer;
begin
  perform private.require_staff(true);
  if p_page_size is null or p_page_size not between 1 and 100 then
    perform private.raise('validation', 'Sayfa boyutu 1 ile 100 arasında olmalı.');
  end if;

  -- Equal last-seen times keep the order of registration.
  select coalesce(array_agg(x.id order by x.last_seen_at desc, x.created_at, x.id), '{}')
  into v_ids
  from public.explorers x
  where x.id not in (select p.id from private.preview_only_explorers() as p (id))
    and (
      v_needle = ''
      or strpos(private.tr_lower(x.nickname), v_needle) > 0
      -- The first "#" of the needle is ignored (like String#replace).
      or strpos(lower(x.display_code), regexp_replace(v_needle, '#', '')) > 0
    )
    and (
      (v_kit = 'all' and v_completed = 'all')
      or (
        (v_kit = 'all' or exists (
          select 1 from public.explorer_kit_progress p
          where p.explorer_id = x.id and p.kit_id::text = v_kit
        ))
        and case v_completed
          when 'yes' then exists (
            select 1 from public.explorer_kit_progress p
            where p.explorer_id = x.id and (v_kit = 'all' or p.kit_id::text = v_kit)
              and p.completed_at is not null
          )
          when 'no' then not exists (
            select 1 from public.explorer_kit_progress p
            where p.explorer_id = x.id and (v_kit = 'all' or p.kit_id::text = v_kit)
              and p.completed_at is not null
          )
          else true
        end
      )
    );

  v_total := cardinality(v_ids);
  v_page_count := greatest(1, ceil(v_total::numeric / p_page_size)::integer);
  v_page := least(greatest(1, coalesce(p_page, 1)), v_page_count);
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(private.explorer_row(x) order by i.ord)
      from unnest(v_ids[(v_page - 1) * p_page_size + 1 : v_page * p_page_size])
        with ordinality as i (id, ord)
      join public.explorers x on x.id = i.id
    ), '[]'),
    'total', v_total,
    'page', v_page,
    'pageCount', v_page_count
  );
end;
$$;

-- One member: row, full timeline (preview events included), kits and badges.
create function public.analytics_explorer_detail(p_explorer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_explorer public.explorers;
begin
  perform private.require_staff(true);
  select * into v_explorer from public.explorers x where x.id = p_explorer;
  if v_explorer.id is null then
    perform private.raise('not_found', 'Kâşif bulunamadı.');
  end if;

  return jsonb_build_object(
    'row', private.explorer_row(v_explorer),
    'timeline', private.feed_items(array(
      select e.id from public.explorer_events e
      where e.explorer_id = p_explorer
      order by e.occurred_at desc, e.id desc
    ), true),
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kitId', p.kit_id,
        'title', coalesce(k.title, 'Silinmiş kit'),
        'completedSteps', cardinality(p.completed_steps),
        'totalSteps', coalesce(jsonb_array_length(k.document -> 'steps'), cardinality(p.completed_steps)),
        'completedAt', private.iso_time(p.completed_at),
        'startedAt', private.iso_time(p.started_at)
      ) order by p.started_at, p.kit_id)
      from public.explorer_kit_progress p
      left join private.analytics_kits() k on k.kit_id = p.kit_id
      where p.explorer_id = p_explorer
    ), '[]'),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'badgeId', b.badge_id,
        'name', coalesce(
          private.global_badge(b.badge_id) ->> 'name', k.document -> 'badge' ->> 'name', 'Kit rozeti'
        ),
        'emoji', coalesce(
          private.global_badge(b.badge_id) ->> 'emoji', k.document -> 'badge' ->> 'emoji', '🏅'
        ),
        'earnedAt', private.iso_time(b.earned_at)
      ) order by b.earned_at, b.badge_id)
      from public.explorer_badges b
      left join private.analytics_kits() k on k.kit_id = b.kit_id
      where b.explorer_id = p_explorer
    ), '[]')
  );
end;
$$;

-- KVKK m.11: everything stored about one member, as JSON (the Kâşif kodu hash is left out).
create function public.analytics_export_explorer(p_explorer uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_explorer public.explorers;
begin
  select * into v_explorer from public.explorers x where x.id = p_explorer;
  if v_explorer.id is null then
    perform private.raise('not_found', 'Kâşif bulunamadı.');
  end if;
  perform private.audit('explorer.exported', 'explorer', p_explorer::text, '{}', v_admin);

  return jsonb_build_object(
    'exportedAt', private.iso_time(now()),
    'note', 'KVKK m.11 kapsamında kâşif üyeliğine ait tüm kayıtlar. Kâşif kodu sunucuda yalnızca özet olarak tutulur ve bu dosyada yer almaz.',
    'explorer', jsonb_build_object(
      'id', v_explorer.id,
      'nickname', v_explorer.nickname,
      'avatar', v_explorer.avatar,
      'displayCode', v_explorer.display_code,
      'settings', v_explorer.settings,
      'createdVia', v_explorer.created_via,
      'createdAt', private.iso_time(v_explorer.created_at),
      'lastSeenAt', private.iso_time(v_explorer.last_seen_at)
    ),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'linkedAt', private.iso_time(d.linked_at),
        'lastSeenAt', private.iso_time(d.last_seen_at)
      ) order by d.linked_at, d.device_uid)
      from public.explorer_devices d
      where d.explorer_id = p_explorer
    ), '[]'),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'explorerId', p.explorer_id,
        'kitId', p.kit_id,
        'startedAt', private.iso_time(p.started_at),
        'completedAt', private.iso_time(p.completed_at),
        'completedSteps', to_jsonb(p.completed_steps),
        'qrScans', p.qr_scans,
        'totalDurationMs', p.total_duration_ms
      ) order by p.started_at, p.kit_id)
      from public.explorer_kit_progress p
      where p.explorer_id = p_explorer
    ), '[]'),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'explorerId', b.explorer_id,
        'badgeId', b.badge_id,
        'kitId', b.kit_id,
        'earnedAt', private.iso_time(b.earned_at)
      ) order by b.earned_at, b.badge_id)
      from public.explorer_badges b
      where b.explorer_id = p_explorer
    ), '[]'),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'clientEventId', e.client_event_id,
        'explorerId', e.explorer_id,
        'kitId', e.kit_id,
        'stepId', e.step_id,
        'occurredAt', private.iso_time(e.occurred_at),
        'isPreview', e.is_preview,
        'type', e.type,
        'data', e.data,
        'receivedAt', private.iso_time(e.received_at)
      ) order by e.id)
      from public.explorer_events e
      where e.explorer_id = p_explorer
    ), '[]')
  );
end;
$$;

-- KVKK m.7 by an admin: the member and everything it did (secrets, devices, events, progress
-- and badges cascade).
create function public.analytics_delete_explorer(p_explorer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
begin
  delete from public.explorers x where x.id = p_explorer;
  if not found then
    perform private.raise('not_found', 'Kâşif bulunamadı.');
  end if;
  perform private.audit('explorer.deleted', 'explorer', p_explorer::text, '{}', v_admin);
end;
$$;

-- Centre-wide numbers for a range of Istanbul days: unique/new/returning members, average
-- visit (one member's events within a day), daily series and kit comparison.
create function public.analytics_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_staff();

  with ev as (
    select e.explorer_id, e.kit_id, e.type,
      (e.occurred_at at time zone 'Europe/Istanbul')::date as day,
      -- Milliseconds, as the ISO strings of the mock carry them.
      floor(extract(epoch from e.occurred_at) * 1000) as ms
    from public.explorer_events e
    where not e.is_preview
      and e.occurred_at >= private.istanbul_day_start(p_from)
      and e.occurred_at < private.istanbul_day_start(p_to + 1)
  ),
  uniques as (
    select distinct ev.explorer_id from ev
  ),
  newcomers as (
    select u.explorer_id
    from uniques u
    join public.explorers x on x.id = u.explorer_id
    where (x.created_at at time zone 'Europe/Istanbul')::date between p_from and p_to
  ),
  visits as (
    select max(ev.ms) - min(ev.ms) as duration
    from ev
    group by ev.explorer_id, ev.day
  ),
  daily as (
    select d.day, count(distinct ev.explorer_id) as uniques, count(ev.explorer_id) as events
    from (select p_from + o as day from generate_series(0, least(p_to - p_from, 399)) as o) d
    left join ev on ev.day = d.day
    group by d.day
  ),
  kits as (
    select k.kit_id, k.title, k.created_at,
      count(distinct ev.explorer_id) filter (where ev.type in ('kit_open', 'card_open')) as starts,
      count(distinct ev.explorer_id) filter (where ev.type = 'kit_complete') as completions,
      count(ev.kit_id) filter (where ev.type = 'qr_scan') as scans
    from private.analytics_kits() k
    left join ev on ev.kit_id = k.kit_id
    group by k.kit_id, k.title, k.created_at
  )
  select jsonb_build_object(
    'uniqueExplorers', (select count(*) from uniques),
    'newExplorers', (select count(*) from newcomers),
    'returningExplorers', (select count(*) from uniques) - (select count(*) from newcomers),
    'avgVisitMs', coalesce((select round(avg(v.duration)) from visits v where v.duration > 0), 0),
    'events', (select count(*) from ev),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day, 'uniques', d.uniques, 'events', d.events
      ) order by d.day)
      from daily d
    ), '[]'),
    -- Equal starts keep the kit order (oldest kit first).
    'kits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kitId', k.kit_id,
        'title', k.title,
        'starts', k.starts,
        'completions', k.completions,
        'completionRate', case when k.starts > 0 then k.completions::float8 / k.starts else 0 end,
        'scans', k.scans
      ) order by k.starts desc, k.created_at, k.kit_id)
      from kits k
      where k.starts > 0 or k.scans > 0
    ), '[]'),
    -- Raw events are kept for 60 days (RAW_RETENTION_DAYS).
    'rangeWithinRetention',
      private.istanbul_day_start(p_from) >= now() - interval '1440 hours'
  )
  into v_result;
  return v_result;
end;
$$;

-- Rows of the events CSV (live events of the range, oldest first, members named). The app
-- builds the file with analyticsCsv() in compute.ts, like the mock adapter.
create function public.analytics_csv_rows(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_items jsonb;
begin
  v_items := private.feed_items(array(
    select e.id from public.explorer_events e
    where not e.is_preview
      and e.occurred_at >= private.istanbul_day_start(p_from)
      and e.occurred_at < private.istanbul_day_start(p_to + 1)
    order by e.occurred_at, e.id
  ), true);
  perform private.audit('analytics.csv_exported', 'analytics', null,
    jsonb_build_object('from', p_from, 'to', p_to), v_admin);
  return v_items;
end;
$$;

grant execute on function
  public.analytics_dashboard(),
  public.analytics_kit_stats(uuid, date, date),
  public.analytics_explorers(text, integer, integer, text, text),
  public.analytics_explorer_detail(uuid),
  public.analytics_export_explorer(uuid),
  public.analytics_delete_explorer(uuid),
  public.analytics_overview(date, date),
  public.analytics_csv_rows(date, date)
to authenticated;
