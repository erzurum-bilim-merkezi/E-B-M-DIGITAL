-- Studio accounts, platform settings, centre tablets and the media library. Same rules as the
-- mock adapters (auth.mock.ts, settings.ts, media.mock.ts). Account creation, password resets
-- and bans need the auth admin API: the admin-users Edge Function does those and calls the
-- staff_* RPCs below with the admin's own JWT, so permissions and the audit trail stay here.

-- ---------------------------------------------------------------------------------------------
-- Studio accounts
-- ---------------------------------------------------------------------------------------------

create function private.staff_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'displayName', p.display_name,
    'role', p.role,
    'active', p.active,
    'mustChangePassword', p.must_change_password,
    'totpEnrolled', exists (
      select 1 from auth.mfa_factors f
      where f.user_id = p.id and f.factor_type::text = 'totp' and f.status::text = 'verified'
    ),
    'createdAt', p.created_at,
    'lastSignInAt', u.last_sign_in_at
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user
$$;

-- The signed-in Studio user (any assurance level: the sign-in flow reads it before TOTP), with
-- whether a temporary password has expired.
create function public.my_staff_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_json(p.id) || jsonb_build_object(
    'tempPasswordExpired',
    p.must_change_password and p.temp_password_expires_at is not null
      and p.temp_password_expires_at < now()
  )
  from public.profiles p
  where p.id = auth.uid() and not private.is_anonymous()
$$;

create function public.staff_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(true);
  return coalesce((
    select jsonb_agg(private.staff_json(p.id) order by p.created_at)
    from public.profiles p
  ), '[]');
end;
$$;

-- Voluntary password change: the current password is checked here (bcrypt of auth.users) and
-- wrong guesses share the 5-failure lock, so an unattended session cannot brute-force it.
create function public.verify_current_password(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_remaining integer;
  v_locked constant text := 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.';
begin
  if v_user is null or private.is_anonymous()
    or not exists (select 1 from public.profiles p where p.id = v_user and p.active) then
    return private.error('unauthorized', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  end if;
  if private.attempt_locked('current-password', v_user::text) then
    return private.error('rate_limited', v_locked);
  end if;
  select u.encrypted_password into v_hash from auth.users u where u.id = v_user;
  if v_hash is null or extensions.crypt(coalesce(p_password, ''), v_hash) <> v_hash then
    v_remaining := private.record_failure('current-password', v_user::text);
    if v_remaining = 0 then
      return private.error('rate_limited', v_locked);
    end if;
    return private.error('validation', 'Mevcut parola hatalı.',
      jsonb_build_object('remaining', v_remaining));
  end if;
  perform private.clear_failures('current-password', v_user::text);
  return jsonb_build_object('ok', true);
end;
$$;

-- After auth.updateUser({ password }): clears the "change your temporary password" flag.
create function public.complete_password_change()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or private.is_anonymous()
    or not exists (select 1 from public.profiles p where p.id = v_user and p.active) then
    perform private.raise('unauthorized', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  end if;
  update public.profiles p set must_change_password = false, temp_password_expires_at = null
  where p.id = v_user;
  perform private.clear_failures('current-password', v_user::text);
  perform private.audit('auth.password_changed', 'staff_user', v_user::text);
  return private.staff_json(v_user);
end;
$$;

-- Never leaves the Studio without an active admin (row lock: two admins demoting each other
-- at the same time cannot both succeed).
create function private.assert_keeps_an_admin(p_user uuid, p_role public.app_role, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  perform 1 from public.profiles p where p.role = 'admin' and p.active for update;
  select count(*) into v_remaining from public.profiles p
  where p.role = 'admin' and p.active and p.id <> p_user;
  if v_remaining = 0 and not (p_role = 'admin' and p_active) then
    perform private.raise('conflict', 'Son aktif yönetici kaldırılamaz. Önce başka bir yönetici ekleyin.');
  end if;
end;
$$;

-- admin-users checks the caller with this before touching the auth admin API.
create function public.staff_assert_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(true);
  return true;
end;
$$;

-- Called by admin-users after auth.admin.createUser (temporary password, 72 h).
create function public.staff_register(
  p_user uuid,
  p_email text,
  p_display_name text,
  p_role public.app_role
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
begin
  if char_length(btrim(coalesce(p_display_name, ''))) not between 2 and 60 then
    perform private.raise('validation', 'Ad 2–60 karakter olmalı.');
  end if;
  insert into public.profiles
    (id, email, display_name, role, must_change_password, temp_password_expires_at)
  values (p_user, lower(btrim(p_email)), btrim(p_display_name), p_role, true,
    now() + interval '72 hours');
  perform private.audit('user.created', 'staff_user', p_user::text,
    jsonb_build_object('role', p_role), v_admin);
  return private.staff_json(p_user);
exception when unique_violation then
  perform private.raise('conflict', 'Bu e-posta ile bir kullanıcı zaten var.');
end;
$$;

create function public.staff_mark_password_reset(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
begin
  update public.profiles p set
    must_change_password = true,
    temp_password_expires_at = now() + interval '72 hours'
  where p.id = p_user;
  if not found then perform private.raise('not_found', 'Kullanıcı bulunamadı.'); end if;
  perform private.audit('user.password_reset', 'staff_user', p_user::text, '{}', v_admin);
  return private.staff_json(p_user);
end;
$$;

create function public.staff_update(
  p_user uuid,
  p_role public.app_role default null,
  p_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles p where p.id = p_user for update;
  if v_profile.id is null then perform private.raise('not_found', 'Kullanıcı bulunamadı.'); end if;
  perform private.assert_keeps_an_admin(
    p_user, coalesce(p_role, v_profile.role), coalesce(p_active, v_profile.active)
  );
  update public.profiles p set
    role = coalesce(p_role, p.role),
    active = coalesce(p_active, p.active)
  where p.id = p_user;
  if p_role is not null and p_role <> v_profile.role then
    perform private.audit('user.role_changed', 'staff_user', p_user::text,
      jsonb_build_object('role', p_role), v_admin);
  end if;
  if p_active is not null and p_active <> v_profile.active then
    perform private.audit(case when p_active then 'user.activated' else 'user.deactivated' end,
      'staff_user', p_user::text, '{}', v_admin);
  end if;
  return private.staff_json(p_user);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Settings, audit, AI usage
-- ---------------------------------------------------------------------------------------------

create function public.settings_update(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_next jsonb;
begin
  if jsonb_typeof(p_patch) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) k
    where k not in ('aiProvider', 'aiDailyProjectLimit', 'aiDailyUserLimit', 'aiSuggestionCount',
      'rawEventRetentionDays', 'inactiveExplorerMonths', 'educatorConsentStep')
  ) then
    perform private.raise('validation', 'Ayar değerleri izin verilen aralığın dışında.');
  end if;
  select s.value || p_patch into v_next from public.app_settings s where s.id = 1 for update;
  if not (
    v_next ->> 'aiProvider' in ('gemini', 'fake', 'off')
    and jsonb_typeof(v_next -> 'aiDailyProjectLimit') = 'number'
    and (v_next ->> 'aiDailyProjectLimit')::numeric between 0 and 10000
    and (v_next ->> 'aiDailyProjectLimit')::numeric % 1 = 0
    and jsonb_typeof(v_next -> 'aiDailyUserLimit') = 'number'
    and (v_next ->> 'aiDailyUserLimit')::numeric between 0 and 500
    and (v_next ->> 'aiDailyUserLimit')::numeric % 1 = 0
    and jsonb_typeof(v_next -> 'aiSuggestionCount') = 'number'
    and (v_next ->> 'aiSuggestionCount')::numeric in (1, 2, 3)
    and jsonb_typeof(v_next -> 'rawEventRetentionDays') = 'number'
    and (v_next ->> 'rawEventRetentionDays')::numeric between 7 and 60
    and (v_next ->> 'rawEventRetentionDays')::numeric % 1 = 0
    and jsonb_typeof(v_next -> 'inactiveExplorerMonths') = 'number'
    and (v_next ->> 'inactiveExplorerMonths')::numeric between 3 and 24
    and (v_next ->> 'inactiveExplorerMonths')::numeric % 1 = 0
    and jsonb_typeof(v_next -> 'educatorConsentStep') = 'boolean'
  ) then
    perform private.raise('validation', 'Ayar değerleri izin verilen aralığın dışında.');
  end if;
  update public.app_settings s set value = v_next, updated_by = v_admin, updated_at = now()
  where s.id = 1;
  perform private.audit('settings.updated', 'settings', null,
    jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)), v_admin);
  return v_next;
end;
$$;

-- Successful AI generations per Istanbul day, the last 14 days.
create function public.ai_usage_daily()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(true);
  return (
    select jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(u.count, 0)) order by d.day)
    from (
      select to_char((now() at time zone 'Europe/Istanbul')::date - offs, 'YYYY-MM-DD') as day
      from generate_series(13, 0, -1) as offs
    ) d
    left join (
      select to_char((a.created_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as day,
        count(*) as count
      from public.ai_usage a
      where a.status = 'ok' and a.created_at > now() - interval '15 days'
      group by 1
    ) u on u.day = d.day
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Centre tablets (Studio side)
-- ---------------------------------------------------------------------------------------------

create function private.center_device_json(p_device public.center_devices)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_device.id,
    'label', p_device.label,
    'setupExpiresAt', p_device.setup_expires_at,
    'deviceUid', p_device.device_uid,
    'activatedAt', p_device.activated_at,
    'revokedAt', p_device.revoked_at,
    'createdBy', p_device.created_by,
    'createdAt', p_device.created_at
  )
$$;

-- New centre tablet: returns the single-use setup code (24 h) once.
create function public.center_device_create(p_label text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_id uuid := gen_random_uuid();
  v_code text := private.random_code(6);
  v_device public.center_devices;
begin
  if coalesce(btrim(p_label), '') = '' then
    perform private.raise('validation', 'Cihaza bir ad verin (ör. “Giriş tableti 1”).');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,8}$' then
    perform private.raise('validation', 'PIN 4–8 rakam olmalı.');
  end if;
  insert into public.center_devices
    (id, label, setup_code_hash, setup_expires_at, pin_hash, created_by)
  values (
    v_id, left(btrim(p_label), 60),
    private.sha256_hex('kasif-restore:center:' || v_code),
    now() + interval '24 hours',
    private.sha256_hex('kasif-center-pin:' || v_id::text || ':' || p_pin),
    v_admin
  )
  returning * into v_device;
  perform private.audit('center_device.created', 'center_device', v_id::text, '{}', v_admin);
  return jsonb_build_object('device', private.center_device_json(v_device), 'setupCode', v_code);
end;
$$;

create function public.center_device_revoke(p_device uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
begin
  update public.center_devices c set revoked_at = now(), setup_code_hash = null
  where c.id = p_device;
  perform private.audit('center_device.revoked', 'center_device', p_device::text, '{}', v_admin);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------------------------

create function private.media_json(p_asset public.media_assets)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_asset.id,
    'kind', p_asset.kind,
    'name', p_asset.name,
    'mime', p_asset.mime,
    'bytes', p_asset.bytes,
    'width', p_asset.width,
    'height', p_asset.height,
    'durationSec', p_asset.duration_sec,
    'alt', p_asset.alt,
    'path', p_asset.path,
    'source', p_asset.source,
    'sceneGroup', p_asset.scene_group,
    'sceneState', p_asset.scene_state,
    'createdBy', p_asset.created_by,
    'createdAt', p_asset.created_at
  )
$$;

-- Registers a file the Studio has just uploaded to the `media` bucket (uploads/<id>.<ext>).
-- AI drawings are stored by the ai-generate function, never through here.
create function public.media_register(
  p_id uuid,
  p_kind public.media_kind,
  p_name text,
  p_mime text,
  p_alt text,
  p_width integer default null,
  p_height integer default null,
  p_duration_sec real default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_object record;
  v_limit integer;
  v_asset public.media_assets;
begin
  if p_kind in ('ai-scene', 'ai-icon') then
    perform private.raise('forbidden', 'Yapay zekâ çizimleri yalnızca yapay zekâ stüdyosundan kaydedilir.');
  end if;
  select o.name, (o.metadata ->> 'size')::integer as size, o.metadata ->> 'mimetype' as mimetype
  into v_object
  from storage.objects o
  where o.bucket_id = 'media' and o.name like 'uploads/' || p_id::text || '.%';
  if v_object.name is null then
    perform private.raise('not_found', 'Dosya yüklenemedi. Tekrar deneyin.');
  end if;
  if not (
    (p_kind = 'image' and p_mime in ('image/webp', 'image/png', 'image/jpeg'))
    or (p_kind = 'icon' and p_mime in ('image/webp', 'image/png'))
    or (p_kind = 'audio' and p_mime in ('audio/mpeg', 'audio/mp4'))
    or (p_kind = 'captions' and p_mime = 'text/vtt')
  ) or coalesce(v_object.mimetype, p_mime) <> p_mime then
    perform private.raise('validation', 'Bu dosya türü kabul edilmiyor.');
  end if;
  v_limit := case p_kind
    when 'image' then 300000
    when 'icon' then 150000
    when 'audio' then 1048576
    else 102400
  end;
  if coalesce(v_object.size, 0) > v_limit then
    perform private.raise('validation', 'Dosya boyut sınırını aşıyor.');
  end if;
  if p_kind in ('image', 'icon') and coalesce(btrim(p_alt), '') = '' then
    perform private.raise('validation', 'Görseller için alternatif metin zorunlu.');
  end if;
  insert into public.media_assets
    (id, kind, name, mime, bytes, width, height, duration_sec, alt, path, source, created_by)
  values (p_id, p_kind, left(coalesce(p_name, ''), 120), p_mime, coalesce(v_object.size, 0),
    p_width, p_height, p_duration_sec, left(btrim(coalesce(p_alt, '')), 240), v_object.name,
    'upload', v_user)
  returning * into v_asset;
  return private.media_json(v_asset);
end;
$$;

create function public.media_update_alt(p_id uuid, p_alt text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets;
begin
  perform private.require_staff();
  update public.media_assets m set alt = left(btrim(coalesce(p_alt, '')), 240)
  where m.id = p_id returning * into v_asset;
  if v_asset.id is null then perform private.raise('not_found', 'Dosya bulunamadı.'); end if;
  return private.media_json(v_asset);
end;
$$;

-- Kits whose draft or published versions reference the asset (asset ids are UUIDs, unique in
-- any document text).
create function private.media_usage(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('kits', coalesce(jsonb_agg(u order by u ->> 'title'), '[]'))
  from (
    select jsonb_build_object(
      'id', k.id,
      'title', coalesce(k.draft ->> 'title', max(v.document ->> 'title')),
      'inDraft', strpos(k.draft::text, p_id::text) > 0,
      'versions', coalesce(jsonb_agg(v.version order by v.version)
        filter (where v.version is not null), '[]')
    ) as u
    from public.kits k
    left join public.kit_versions v
      on v.kit_id = k.id and strpos(v.document::text, p_id::text) > 0
    group by k.id
    having strpos(k.draft::text, p_id::text) > 0 or count(v.version) > 0
  ) usage
$$;

create function public.media_usage(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return private.media_usage(p_id);
end;
$$;

-- Deletes the record of an unused asset and returns its object path; the Studio then removes
-- the file from Storage (admins may delete in the media bucket).
create function public.media_delete(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_staff(true);
  v_asset public.media_assets;
  v_usage jsonb := private.media_usage(p_id);
begin
  select * into v_asset from public.media_assets m where m.id = p_id for update;
  if v_asset.id is null then perform private.raise('not_found', 'Dosya bulunamadı.'); end if;
  if jsonb_array_length(v_usage -> 'kits') > 0 then
    perform private.raise('conflict', 'Bu dosya kullanımda. Önce kitlerden kaldırın.',
      jsonb_build_object('usage', v_usage));
  end if;
  delete from public.media_assets m where m.id = p_id;
  perform private.audit('media.deleted', 'media', p_id::text,
    jsonb_build_object('name', v_asset.name), v_admin);
  return v_asset.path;
end;
$$;

-- Free-plan gauges (ADR 0020): storage, database size and a monthly egress estimate
-- (new members of the last 30 days × one download of every live kit's JSON and media).
create function public.storage_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_new_devices integer;
  v_published jsonb;
  v_json_bytes bigint;
  v_media_bytes bigint;
begin
  perform private.require_staff();
  select count(*) into v_new_devices from public.explorers e
  where e.created_at > now() - interval '30 days';
  select coalesce(sum(octet_length(v.document::text)), 0), coalesce(jsonb_agg(v.document), '[]')
  into v_json_bytes, v_published
  from public.kits k
  join public.kit_versions v on v.kit_id = k.id and v.version = k.published_version
  where k.published_version is not null and k.status <> 'archived';
  select coalesce(sum(m.bytes), 0) into v_media_bytes
  from public.media_assets m
  where strpos(v_published::text, m.id::text) > 0;
  return jsonb_build_object(
    'storageBytes', (
      select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.bucket_id in ('media', 'published')
    ),
    'storageLimitBytes', 1073741824,
    'databaseBytes', pg_database_size(current_database()),
    'databaseLimitBytes', 524288000,
    'estimatedMonthlyEgressBytes', greatest(1, v_new_devices) * (v_json_bytes + v_media_bytes),
    'egressLimitBytes', 10737418240
  );
end;
$$;

grant execute on function
  public.my_staff_profile(),
  public.staff_list(),
  public.staff_assert_admin(),
  public.verify_current_password(text),
  public.complete_password_change(),
  public.staff_register(uuid, text, text, public.app_role),
  public.staff_mark_password_reset(uuid),
  public.staff_update(uuid, public.app_role, boolean),
  public.settings_update(jsonb),
  public.ai_usage_daily(),
  public.center_device_create(text, text),
  public.center_device_revoke(uuid),
  public.media_register(uuid, public.media_kind, text, text, text, integer, integer, real),
  public.media_update_alt(uuid, text),
  public.media_usage(uuid),
  public.media_delete(uuid),
  public.storage_quota()
to authenticated;
