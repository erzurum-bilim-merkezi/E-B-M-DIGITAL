-- Kâşif membership RPCs (ADR 0009, 0017), called by the anonymous device session of the app.
-- Same rules as the mock adapter (src/features/explorer/api/explorer.mock.ts):
--   * a personal device holds up to 10 members; a centre tablet seats one member at a time
--   * the Kâşif kodu is stored as a SHA-256 hash only and shown in plain text once
--   * wrong codes / PINs / setup codes: 5 failures lock the device for 15 minutes, plus a looser
--     per-IP limit so fresh anonymous sessions cannot be used to keep guessing

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- Same rules as entities/explorer/nickname.ts (the app checks first; this is the server copy).
create function private.nickname_problem(p_nickname text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_folded text;
  v_joined text;
  v_word text;
begin
  if char_length(v_value) < 2 then return 'too-short'; end if;
  if char_length(v_value) > 20 then return 'too-long'; end if;
  if v_value !~ '^[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+( [A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+)*$' then
    return 'characters';
  end if;
  -- Turkish-aware fold to ASCII (I → ı → i, İ → i), like fold() in nickname.ts.
  v_folded := lower(translate(v_value, 'ÇĞIİÖŞÜÂÎÛçğıöşüâîû', 'cgiiosuaiucgiosuaiu'));
  v_joined := regexp_replace(v_folded, '[^a-z]', '', 'g');
  if v_joined ~ '(orospu|orosbu|siktir|sikik|sikerim|yarrak|yarak|pezevenk|kahpe|kaltak|gerizekali|serefsiz|haysiyetsiz|dangalak|pust|gavat|ibne|aminakoy|kodumun)' then
    return 'inappropriate';
  end if;
  foreach v_word in array string_to_array(v_folded, ' ') loop
    if v_word = any (array['amk', 'amq', 'aq', 'mk', 'oc', 'pic', 'sik', 'got', 'mal', 'salak',
                           'aptal', 'it', 'ahmak', 'embesil']) then
      return 'inappropriate';
    end if;
  end loop;
  return null;
end;
$$;

create function private.nickname_message(p_problem text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_problem
    when 'too-short' then 'Adın en az 2 harf olmalı.'
    when 'too-long' then 'Adın en fazla 20 harf olabilir.'
    when 'characters' then 'Yalnızca harf ve boşluk kullanabilirsin.'
    else 'Bu ad olmaz. Başka bir ad dener misin? 🙂'
  end
$$;

create function private.explorer_json(p_explorer public.explorers)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_explorer.id,
    'nickname', p_explorer.nickname,
    'avatar', p_explorer.avatar,
    'displayCode', p_explorer.display_code,
    'settings', p_explorer.settings,
    'createdVia', p_explorer.created_via,
    'createdAt', p_explorer.created_at,
    'lastSeenAt', p_explorer.last_seen_at
  )
$$;

create function private.is_center_device(p_device uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.center_devices c where c.device_uid = p_device and c.revoked_at is null
  )
$$;

-- The caller's address as Cloudflare (in front of every hosted Supabase project) states it. The
-- client cannot set this header; X-Forwarded-For it can. Null locally and outside API requests.
create function private.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(
    coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip', '')
  ), '')
$$;

-- Per-IP guard over all devices behind one address: 50 failures in 15 minutes.
create function private.ip_locked(p_bucket text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.client_ip() is not null and exists (
    select 1 from public.rate_limit_counters c
    where c.bucket = p_bucket || '-ip' and c.subject = private.client_ip()
      and c.count >= 50 and c.window_start > now() - interval '15 minutes'
  )
$$;

create function private.record_ip_failure(p_bucket text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := private.client_ip();
  v_window timestamptz;
begin
  if v_ip is null then return; end if;
  select c.window_start into v_window from public.rate_limit_counters c
  where c.bucket = p_bucket || '-ip' and c.subject = v_ip;
  if v_window is null or v_window <= now() - interval '15 minutes' then
    delete from public.rate_limit_counters c where c.bucket = p_bucket || '-ip' and c.subject = v_ip;
    insert into public.rate_limit_counters (bucket, subject, window_start, count)
    values (p_bucket || '-ip', v_ip, now(), 1);
  else
    update public.rate_limit_counters c set count = c.count + 1
    where c.bucket = p_bucket || '-ip' and c.subject = v_ip;
  end if;
end;
$$;

-- Raises unless the member is linked to the calling device; returns the member.
create function private.require_linked(p_explorer uuid)
returns public.explorers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_explorer public.explorers;
begin
  if not exists (
    select 1 from public.explorer_devices d
    where d.explorer_id = p_explorer and d.device_uid = v_device
  ) then
    perform private.raise('forbidden', 'Bu kâşif bu cihaza bağlı değil.');
  end if;
  select * into v_explorer from public.explorers e where e.id = p_explorer;
  if v_explorer.id is null then
    perform private.raise('not_found', 'Kâşif üyeliği bulunamadı.');
  end if;
  return v_explorer;
end;
$$;

-- Personal devices: at most 10 linked members (a member already linked does not count again).
create function private.can_link_more(p_device uuid, p_explorer uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_center_device(p_device)
    or exists (
      select 1 from public.explorer_devices d
      where d.device_uid = p_device and d.explorer_id = p_explorer
    )
    or (select count(*) from public.explorer_devices d where d.device_uid = p_device) < 10
$$;

create function private.link_explorer(p_explorer uuid, p_device uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.explorer_devices (explorer_id, device_uid)
  values (p_explorer, p_device)
  on conflict (explorer_id, device_uid)
  do update set linked_at = now(), last_seen_at = now();
  -- A centre tablet seats one explorer at a time: joining ends every other member's session.
  if private.is_center_device(p_device) then
    delete from public.explorer_devices d
    where d.device_uid = p_device and d.explorer_id <> p_explorer;
  end if;
end;
$$;

-- New Kâşif kodu (8 chars, ~40 bits); only its hash is kept.
create function private.set_restore_code(p_explorer uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := private.random_code(8);
    begin
      insert into public.explorer_secrets (explorer_id, restore_code_hash)
      values (p_explorer, private.sha256_hex('kasif-restore:' || v_code))
      on conflict (explorer_id)
      do update set restore_code_hash = excluded.restore_code_hash;
      return v_code;
    exception when unique_violation then
      -- Another member holds this hash (1 in 10^12): draw again.
    end;
  end loop;
  return null; -- not reached: the loop only ends by returning
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

create function public.register_explorer(p_nickname text, p_avatar text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_problem text := private.nickname_problem(p_nickname);
  v_explorer public.explorers;
begin
  if v_problem is not null then
    perform private.raise('validation', private.nickname_message(v_problem),
      jsonb_build_object('problem', v_problem));
  end if;
  if p_avatar is null or p_avatar not in ('indigo', 'teal', 'sun', 'coral', 'leaf', 'berry') then
    perform private.raise('validation', 'Bir avatar seç.');
  end if;
  if not private.can_link_more(v_device) then
    perform private.raise('conflict', 'Bu cihaza en fazla 10 kâşif eklenebilir. Önce birini çıkarın.');
  end if;
  -- New members per device and hour: enough for a class on a centre tablet, not for a script
  -- filling the database.
  perform private.lock_attempts('register', v_device::text);
  if coalesce((
    select c.count from public.rate_limit_counters c
    where c.bucket = 'register' and c.subject = v_device::text
      and c.window_start = date_trunc('hour', now())
  ), 0) >= 30 then
    perform private.raise('rate_limited',
      'Bu cihazda çok fazla yeni kâşif oluşturuldu. Biraz sonra tekrar deneyin.');
  end if;
  insert into public.rate_limit_counters (bucket, subject, window_start, count)
  values ('register', v_device::text, date_trunc('hour', now()), 1)
  on conflict (bucket, subject, window_start)
  do update set count = public.rate_limit_counters.count + 1;

  insert into public.explorers (nickname, avatar, display_code, created_via)
  values (
    btrim(regexp_replace(p_nickname, '\s+', ' ', 'g')),
    p_avatar,
    private.random_code(4),
    case when private.is_center_device(v_device) then 'center' else 'self' end
  )
  returning * into v_explorer;
  perform private.link_explorer(v_explorer.id, v_device);

  return jsonb_build_object(
    'explorer', private.explorer_json(v_explorer),
    'restoreCode', private.set_restore_code(v_explorer.id)
  );
end;
$$;

-- `p_code` is the normalised 8-char code (normalizeRestoreCode on the client).
create function public.restore_explorer(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_code text := upper(coalesce(p_code, ''));
  v_explorer public.explorers;
  v_remaining integer;
  v_locked constant text := 'Çok fazla yanlış deneme oldu. 15 dakika sonra tekrar dene ya da eğitmenine sor.';
begin
  perform private.lock_attempts('restore', v_device::text);
  if private.attempt_locked('restore', v_device::text) or private.ip_locked('restore') then
    return private.error('rate_limited', v_locked);
  end if;

  if v_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$' then
    select e.* into v_explorer
    from public.explorer_secrets s
    join public.explorers e on e.id = s.explorer_id
    where s.restore_code_hash = private.sha256_hex('kasif-restore:' || v_code);
  end if;

  if v_explorer.id is null then
    v_remaining := private.record_failure('restore', v_device::text);
    perform private.record_ip_failure('restore');
    if v_remaining = 0 then
      return private.error('rate_limited', v_locked, jsonb_build_object('remaining', 0));
    end if;
    return private.error('not_found', 'Bu Kâşif kodu bulunamadı. Kartındaki kodu kontrol et.',
      jsonb_build_object('remaining', v_remaining));
  end if;

  perform private.clear_failures('restore', v_device::text);
  if not private.can_link_more(v_device, v_explorer.id) then
    return private.error('conflict', 'Bu cihaza en fazla 10 kâşif eklenebilir. Önce birini çıkarın.');
  end if;
  perform private.link_explorer(v_explorer.id, v_device);
  update public.explorers e set last_seen_at = now() where e.id = v_explorer.id
  returning * into v_explorer;

  return jsonb_build_object(
    'ok', true,
    'explorer', private.explorer_json(v_explorer),
    'restoreCode', v_code
  );
end;
$$;

create function public.update_explorer(
  p_explorer uuid,
  p_nickname text default null,
  p_avatar text default null,
  p_settings jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_explorer public.explorers := private.require_linked(p_explorer);
  v_problem text;
begin
  if p_nickname is not null then
    v_problem := private.nickname_problem(p_nickname);
    if v_problem is not null then
      perform private.raise('validation', private.nickname_message(v_problem),
        jsonb_build_object('problem', v_problem));
    end if;
  end if;
  if p_avatar is not null and p_avatar not in ('indigo', 'teal', 'sun', 'coral', 'leaf', 'berry') then
    perform private.raise('validation', 'Bir avatar seç.');
  end if;
  if p_settings is not null and not (
    jsonb_typeof(p_settings -> 'sound') = 'boolean'
    and jsonb_typeof(p_settings -> 'reduceMotion') = 'boolean'
    and p_settings ->> 'textSize' in ('normal', 'large')
  ) then
    perform private.raise('validation', 'Ayarlar geçersiz.');
  end if;

  update public.explorers e set
    nickname = coalesce(btrim(regexp_replace(p_nickname, '\s+', ' ', 'g')), e.nickname),
    avatar = coalesce(p_avatar, e.avatar),
    settings = case
      when p_settings is null then e.settings
      else jsonb_build_object(
        'sound', (p_settings ->> 'sound')::boolean,
        'reduceMotion', (p_settings ->> 'reduceMotion')::boolean,
        'textSize', p_settings ->> 'textSize'
      )
    end,
    last_seen_at = now()
  where e.id = v_explorer.id
  returning * into v_explorer;
  return private.explorer_json(v_explorer);
end;
$$;

create function public.renew_restore_code(p_explorer uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_linked(p_explorer);
  return private.set_restore_code(p_explorer);
end;
$$;

-- "Bu cihazdan çıkar": the member stays, only this device forgets it.
create function public.unlink_explorer(p_explorer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
begin
  delete from public.explorer_devices d
  where d.explorer_id = p_explorer and d.device_uid = v_device;
end;
$$;

create function public.unlink_all_explorers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
begin
  delete from public.explorer_devices d where d.device_uid = v_device;
end;
$$;

-- KVKK m.7: the member and all its activity are deleted (cascade).
create function public.delete_membership(p_explorer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_linked(p_explorer);
  delete from public.explorers e where e.id = p_explorer;
  perform private.audit('explorer.self_deleted', 'explorer', p_explorer::text, '{}', null);
end;
$$;

-- Turns this device into a centre tablet with the single-use setup code from the Studio.
create function public.activate_center_device(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  v_center public.center_devices;
  v_remaining integer;
  v_locked constant text := 'Çok fazla yanlış kurulum kodu denendi. 15 dakika sonra tekrar deneyin.';
begin
  perform private.lock_attempts('center-setup', v_device::text);
  if private.attempt_locked('center-setup', v_device::text) or private.ip_locked('center-setup') then
    return private.error('rate_limited', v_locked);
  end if;
  select * into v_center from public.center_devices c
  where c.setup_code_hash = private.sha256_hex('kasif-restore:center:' || v_code)
    and c.revoked_at is null and c.setup_expires_at > now()
  for update;
  if v_center.id is null then
    v_remaining := private.record_failure('center-setup', v_device::text);
    perform private.record_ip_failure('center-setup');
    if v_remaining = 0 then
      return private.error('rate_limited', v_locked, jsonb_build_object('remaining', 0));
    end if;
    return private.error('not_found', 'Kurulum kodu geçersiz ya da süresi dolmuş.',
      jsonb_build_object('remaining', v_remaining));
  end if;

  perform private.clear_failures('center-setup', v_device::text);
  -- The previous tablet of this record (if any) stops being a centre device.
  update public.center_devices c set
    device_uid = v_device,
    activated_at = now(),
    setup_code_hash = null,
    setup_expires_at = null
  where c.id = v_center.id;
  perform private.audit('center_device.activated', 'center_device', v_center.id::text, '{}', null);
  return jsonb_build_object(
    'ok', true,
    'device', jsonb_build_object('id', v_center.id, 'label', v_center.label)
  );
end;
$$;

-- Leaves kiosk mode with the educator PIN. A device that is no centre tablet just leaves.
create function public.exit_center_mode(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := private.require_device();
  v_center public.center_devices;
  v_remaining integer;
  v_locked constant text := 'Çok fazla yanlış PIN denendi. 15 dakika sonra tekrar deneyin.';
begin
  select * into v_center from public.center_devices c
  where c.device_uid = v_device and c.revoked_at is null;
  if v_center.id is null then
    return jsonb_build_object('ok', true);
  end if;
  perform private.lock_attempts('center-pin', v_device::text);
  if private.attempt_locked('center-pin', v_device::text) then
    return private.error('rate_limited', v_locked);
  end if;
  if v_center.pin_hash <> private.sha256_hex(
    'kasif-center-pin:' || v_center.id::text || ':' || coalesce(p_pin, '')
  ) then
    v_remaining := private.record_failure('center-pin', v_device::text);
    if v_remaining = 0 then
      return private.error('rate_limited', v_locked, jsonb_build_object('remaining', 0));
    end if;
    return private.error('forbidden', 'PIN yanlış.', jsonb_build_object('remaining', v_remaining));
  end if;
  perform private.clear_failures('center-pin', v_device::text);
  update public.center_devices c set device_uid = null where c.id = v_center.id;
  perform private.audit('center_device.exited', 'center_device', v_center.id::text, '{}', null);
  return jsonb_build_object('ok', true);
end;
$$;

-- Whether this device is a centre tablet (restores kiosk mode after a reinstall).
create function public.my_center_device()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', c.id, 'label', c.label)
  from public.center_devices c
  where c.device_uid = auth.uid() and c.revoked_at is null and private.is_anonymous()
$$;

grant execute on function
  public.register_explorer(text, text),
  public.restore_explorer(text),
  public.update_explorer(uuid, text, text, jsonb),
  public.renew_restore_code(uuid),
  public.unlink_explorer(uuid),
  public.unlink_all_explorers(),
  public.delete_membership(uuid),
  public.activate_center_device(text),
  public.exit_center_mode(text),
  public.my_center_device()
to authenticated;
