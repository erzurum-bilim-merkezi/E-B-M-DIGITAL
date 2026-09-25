-- Kit editing, review and publishing RPCs for the Studio. Same rules and messages as the mock
-- adapter (src/features/studio-kits/api/studio-kits.mock.ts). Drafts are built and validated by
-- the shared TypeScript model (entities/kit); the database guards identity, concurrency (lock
-- versions), permissions and the never-reused QR registry.
--
-- Publishing is a resumable saga run by the admin's Studio (ADR 0021):
--   publish_acquire_lease → publish_reserve_version → write kits/<slug>/v<n>.json (Storage)
--   → publish_finalize → rebuild catalog/qr-index/latest (Storage) → publish_release_lease
-- A retry after an interruption reuses the reserved version (same source lock version).

create function private.kit_json(p_kit public.kits)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_kit.id,
    'slug', p_kit.slug,
    'qrPrefix', p_kit.qr_prefix,
    'status', p_kit.status,
    'visibility', p_kit.visibility,
    'draft', p_kit.draft,
    'publishedVersion', p_kit.published_version,
    'firstPublishedAt', p_kit.first_published_at,
    'lastPublishedAt', p_kit.last_published_at,
    'reviewNote', p_kit.review_note,
    'reviewedLockVersion', p_kit.reviewed_lock_version,
    'lockVersion', p_kit.lock_version,
    'publishedLockVersion', p_kit.published_lock_version,
    'ownerId', p_kit.owner_id,
    'createdAt', p_kit.created_at,
    'updatedAt', p_kit.updated_at,
    'updatedBy', p_kit.updated_by
  )
$$;

create function private.version_json(p_version public.kit_versions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kitId', p_version.kit_id,
    'version', p_version.version,
    'document', p_version.document,
    'notes', p_version.notes,
    'publishedBy', p_version.published_by,
    'publishedAt', p_version.published_at,
    'aiReviewConfirmed', p_version.ai_review_confirmed,
    'finalizedAt', p_version.finalized_at,
    'sourceLockVersion', p_version.source_lock_version
  )
$$;

-- The kit, locked for this transaction, or not_found.
create function private.lock_kit(p_kit uuid)
returns public.kits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kit public.kits;
begin
  select * into v_kit from public.kits k where k.id = p_kit for update;
  if v_kit.id is null then
    perform private.raise('not_found', 'Kit bulunamadı.');
  end if;
  return v_kit;
end;
$$;

create function private.assert_editable(p_kit public.kits)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kit.status = 'archived' then
    perform private.raise('conflict', 'Arşivdeki kit düzenlenemez. Önce arşivden çıkarın.');
  end if;
  if p_kit.status = 'in_review' and private.staff_role() = 'editor' then
    perform private.raise('forbidden',
      'İncelemedeki kit kilitli. Düzenlemek için incelemeden geri çekin.');
  end if;
end;
$$;

create function private.assert_lock(p_kit public.kits, p_lock_version integer, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_kit.lock_version is distinct from p_lock_version then
    perform private.raise('conflict', p_message,
      jsonb_build_object('latest', private.kit_json(p_kit)));
  end if;
end;
$$;

-- Prefixes held by kits other than p_except: in use, in the QR registry, or reserved.
create function private.prefixes_held_by_others(p_except uuid default null)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select k.qr_prefix from public.kits k where k.id is distinct from p_except
  union
  select split_part(q.code, '-', 1) from public.qr_codes q where q.kit_id is distinct from p_except
  union
  select r.prefix from public.qr_prefix_reservations r where r.kit_id is distinct from p_except
$$;

-- The first holder of a prefix keeps it forever.
create function private.reserve_prefix(p_prefix text, p_kit uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.qr_prefix_reservations (prefix, kit_id) values (p_prefix, p_kit)
  on conflict (prefix) do nothing
$$;

create function private.validate_identity(p_slug text, p_prefix text, p_except uuid default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 60 then
    perform private.raise('validation', 'Adres yalnızca küçük harf, rakam ve tire içerebilir.');
  end if;
  if p_prefix is null or p_prefix !~ '^[A-Z]{2,4}$' then
    perform private.raise('validation', 'QR öneki 2–4 büyük harf olmalı.');
  end if;
  if exists (select 1 from public.kits k where k.slug = p_slug and k.id is distinct from p_except) then
    perform private.raise('conflict', 'Bu adres başka bir kitte kullanılıyor.');
  end if;
  if p_prefix in (select private.prefixes_held_by_others(p_except)) then
    perform private.raise('conflict',
      'Bu QR öneki kullanılmış. Basılı kodlar karışmasın diye başka bir önek seçin.');
  end if;
end;
$$;

-- Structure the database relies on; the full KitDocument is validated by the app's Zod model.
create function private.assert_draft(p_draft jsonb, p_id uuid, p_slug text, p_prefix text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_draft) <> 'object'
    or jsonb_typeof(p_draft -> 'steps') <> 'array'
    or jsonb_typeof(p_draft -> 'qrSequence') <> 'number'
    or jsonb_typeof(p_draft -> 'title') <> 'string'
    or octet_length(p_draft::text) > 1048576
  then
    perform private.raise('validation', 'Kit taslağı geçersiz.');
  end if;
  if p_draft ->> 'id' <> p_id::text or p_draft ->> 'slug' <> p_slug
    or p_draft ->> 'qrPrefix' <> p_prefix then
    perform private.raise('validation', 'Adres ve QR öneki yalnızca “Yeniden adlandır” ile değişir.');
  end if;
  -- Drafts are always version 0; published snapshots carry their number.
  return jsonb_set(p_draft, '{version}', '0');
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Kit repository
-- ---------------------------------------------------------------------------------------------

-- Creates a kit from a draft built by the app (template, import or duplicate).
create function public.kit_create(
  p_id uuid,
  p_slug text,
  p_qr_prefix text,
  p_draft jsonb,
  p_duplicate_of uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits;
begin
  perform private.validate_identity(p_slug, p_qr_prefix);
  insert into public.kits (id, slug, qr_prefix, draft, owner_id, updated_by)
  values (p_id, p_slug, p_qr_prefix,
    private.assert_draft(p_draft, p_id, p_slug, p_qr_prefix), v_user, v_user)
  returning * into v_kit;
  perform private.reserve_prefix(p_qr_prefix, p_id);
  if p_duplicate_of is null then
    perform private.audit('kit.created', 'kit', p_id::text,
      jsonb_build_object('title', p_draft ->> 'title'));
  else
    perform private.audit('kit.duplicated', 'kit', p_id::text,
      jsonb_build_object('from', p_duplicate_of));
  end if;
  return private.kit_json(v_kit);
exception when unique_violation then
  perform private.raise('conflict', 'Bu adres ya da QR öneki başka bir kitte kullanılıyor.');
end;
$$;

create function public.kit_save_draft(p_kit uuid, p_draft jsonb, p_lock_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits := private.lock_kit(p_kit);
  v_draft jsonb;
begin
  perform private.assert_editable(v_kit);
  perform private.assert_lock(v_kit, p_lock_version, 'Bu kit başka bir yerde değiştirildi.');
  v_draft := private.assert_draft(p_draft, v_kit.id, v_kit.slug, v_kit.qr_prefix);
  if (v_draft ->> 'qrSequence')::integer < (v_kit.draft ->> 'qrSequence')::integer then
    perform private.raise('validation',
      'QR sayacı geri alınamaz (basılı kodlar yeniden kullanılmaz).');
  end if;

  update public.kits k set
    draft = v_draft,
    status = case when k.status = 'published' then 'draft' else k.status end,
    lock_version = k.lock_version + 1,
    updated_at = now(),
    updated_by = v_user
  where k.id = p_kit
  returning * into v_kit;

  -- Autosave runs every few seconds: audit a draft save at most hourly per kit and user.
  if not exists (
    select 1 from public.audit_log a
    where a.action = 'kit.draft_saved' and a.entity_id = p_kit::text and a.actor_id = v_user
      and a.at > now() - interval '1 hour'
  ) then
    perform private.audit('kit.draft_saved', 'kit', p_kit::text);
  end if;
  return private.kit_json(v_kit);
end;
$$;

-- Address and QR prefix: only before the first publish. The app sends the draft with the card
-- codes renamed to the new prefix.
create function public.kit_rename(
  p_kit uuid,
  p_slug text,
  p_qr_prefix text,
  p_draft jsonb,
  p_lock_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits := private.lock_kit(p_kit);
  v_old_prefix text := v_kit.qr_prefix;
begin
  if v_kit.first_published_at is not null then
    perform private.raise('conflict',
      'Yayınlanmış kitin adresi ve QR öneki değişmez (basılı kodlar bozulur).');
  end if;
  perform private.assert_editable(v_kit);
  perform private.assert_lock(v_kit, p_lock_version, 'Bu kit başka bir yerde değiştirildi.');
  perform private.validate_identity(p_slug, p_qr_prefix, p_kit);

  update public.kits k set
    slug = p_slug,
    qr_prefix = p_qr_prefix,
    draft = private.assert_draft(p_draft, p_kit, p_slug, p_qr_prefix),
    lock_version = k.lock_version + 1,
    updated_at = now(),
    updated_by = v_user
  where k.id = p_kit
  returning * into v_kit;
  -- Pending labels may already be printed with the old prefix: it stays with this kit.
  perform private.reserve_prefix(v_old_prefix, p_kit);
  perform private.reserve_prefix(p_qr_prefix, p_kit);
  perform private.audit('kit.renamed', 'kit', p_kit::text,
    jsonb_build_object('slug', p_slug, 'qrPrefix', p_qr_prefix));
  return private.kit_json(v_kit);
end;
$$;

-- Only never-published kits (their codes never went live); the prefix stays retired.
create function public.kit_delete(p_kit uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.first_published_at is not null then
    perform private.raise('conflict', 'Yayınlanmış kit silinemez; bunun yerine arşivleyin.');
  end if;
  perform private.reserve_prefix(v_kit.qr_prefix, p_kit);
  -- A publish that was interrupted before finalizing leaves a reserved version: it goes too.
  delete from public.kit_versions v where v.kit_id = p_kit and v.finalized_at is null;
  delete from public.kits k where k.id = p_kit;
  perform private.audit('kit.deleted', 'kit', p_kit::text,
    jsonb_build_object('title', v_kit.draft ->> 'title'), v_user);
end;
$$;

create function public.kit_identity_taken(
  p_slug text,
  p_qr_prefix text,
  p_except uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'slugTaken', exists (
      select 1 from public.kits k where k.slug = p_slug and k.id is distinct from p_except
    ),
    'prefixTaken', p_qr_prefix in (select private.prefixes_held_by_others(p_except))
  );
end;
$$;

create function public.kit_taken_prefixes()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return array(select p from private.prefixes_held_by_others() p order by p);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Review workflow
-- ---------------------------------------------------------------------------------------------

create function public.kit_submit_for_review(p_kit uuid, p_lock_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.status = 'archived' then
    perform private.raise('conflict', 'Arşivdeki kit incelemeye gönderilemez.');
  end if;
  if v_kit.status = 'in_review' then
    perform private.raise('conflict', 'Kit zaten incelemede.');
  end if;
  if v_kit.lock_version <> p_lock_version then
    perform private.raise('conflict', 'Kaydedilmemiş değişiklikler var. Önce kaydedin.');
  end if;
  update public.kits k set
    status = 'in_review',
    reviewed_lock_version = k.lock_version,
    review_note = null,
    updated_at = now()
  where k.id = p_kit
  returning * into v_kit;
  perform private.audit('kit.submitted', 'kit', p_kit::text, '{}', v_user);
  return private.kit_json(v_kit);
end;
$$;

create function public.kit_withdraw_review(p_kit uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.status <> 'in_review' then
    perform private.raise('conflict', 'Kit incelemede değil.');
  end if;
  update public.kits k set status = 'draft', reviewed_lock_version = null, updated_at = now()
  where k.id = p_kit
  returning * into v_kit;
  perform private.audit('kit.review_withdrawn', 'kit', p_kit::text, '{}', v_user);
  return private.kit_json(v_kit);
end;
$$;

create function public.kit_request_changes(p_kit uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.status <> 'in_review' then
    perform private.raise('conflict', 'Kit incelemede değil.');
  end if;
  if coalesce(btrim(p_note), '') = '' then
    perform private.raise('validation', 'Editöre neyi değiştirmesi gerektiğini yazın.');
  end if;
  update public.kits k set
    status = 'draft',
    review_note = left(btrim(p_note), 1000),
    reviewed_lock_version = null,
    updated_at = now()
  where k.id = p_kit
  returning * into v_kit;
  perform private.audit('kit.changes_requested', 'kit', p_kit::text, '{}', v_user);
  return private.kit_json(v_kit);
end;
$$;

-- Brings a published version back as the draft (identity and QR counter of the kit are kept).
create function public.kit_restore_version(p_kit uuid, p_version integer, p_lock_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff();
  v_kit public.kits := private.lock_kit(p_kit);
  v_document jsonb;
begin
  perform private.assert_editable(v_kit);
  perform private.assert_lock(v_kit, p_lock_version, 'Bu kit başka bir yerde değiştirildi.');
  select v.document into v_document from public.kit_versions v
  where v.kit_id = p_kit and v.version = p_version;
  if v_document is null then
    perform private.raise('not_found', 'Sürüm bulunamadı.');
  end if;
  v_document := v_document || jsonb_build_object(
    'version', 0,
    'slug', v_kit.slug,
    'qrPrefix', v_kit.qr_prefix,
    'qrSequence', greatest(
      (v_kit.draft ->> 'qrSequence')::integer, (v_document ->> 'qrSequence')::integer
    )
  );
  update public.kits k set
    draft = v_document,
    status = 'draft',
    lock_version = k.lock_version + 1,
    updated_at = now(),
    updated_by = v_user
  where k.id = p_kit
  returning * into v_kit;
  perform private.audit('kit.version_restored', 'kit', p_kit::text,
    jsonb_build_object('version', p_version), v_user);
  return private.kit_json(v_kit);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Publishing saga (admins)
-- ---------------------------------------------------------------------------------------------

-- One publish at a time: a 60-second lease the holder renews by acquiring again.
create function public.publish_acquire_lease(p_holder uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken boolean;
begin
  perform private.require_staff(true);
  update public.publish_state s set
    lease_holder = p_holder,
    lease_expires_at = now() + interval '60 seconds'
  where s.id = 1
    and (s.lease_holder is null or s.lease_holder = p_holder or s.lease_expires_at < now())
  returning true into v_taken;
  return coalesce(v_taken, false);
end;
$$;

create function public.publish_release_lease(p_holder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(true);
  update public.publish_state s set lease_holder = null, lease_expires_at = null
  where s.id = 1 and s.lease_holder = p_holder;
end;
$$;

create function public.publish_generation()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff(true);
  return (select s.generation from public.publish_state s where s.id = 1);
end;
$$;

create function private.bump_generation()
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.publish_state s set generation = s.generation + 1 where s.id = 1
  returning s.generation
$$;

-- Reserves the next version for the kit's current draft. `p_document` is the validated draft
-- with media URLs resolved (built by the app). A retry of the same draft gets the same number.
create function public.publish_reserve_version(
  p_kit uuid,
  p_lock_version integer,
  p_document jsonb,
  p_notes text,
  p_ai_review_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
  v_version public.kit_versions;
  v_number integer;
begin
  if v_kit.status = 'archived' then
    perform private.raise('conflict', 'Arşivdeki kit yayınlanamaz. Önce arşivden çıkarın.');
  end if;
  perform private.assert_lock(v_kit, p_lock_version,
    'Kit bu arada değişti. Son hâlini gözden geçirip tekrar yayınlayın.');
  perform private.assert_draft(p_document, v_kit.id, v_kit.slug, v_kit.qr_prefix);

  select * into v_version from public.kit_versions v
  where v.kit_id = p_kit and v.finalized_at is null and v.source_lock_version = v_kit.lock_version;
  if v_version.kit_id is not null then
    return private.version_json(v_version);
  end if;

  select greatest(coalesce(v_kit.published_version, 0), coalesce(max(v.version), 0)) + 1
  into v_number
  from public.kit_versions v where v.kit_id = p_kit;

  insert into public.kit_versions
    (kit_id, version, document, notes, published_by, ai_review_confirmed, source_lock_version)
  values (
    p_kit, v_number, jsonb_set(p_document, '{version}', to_jsonb(v_number)),
    left(btrim(coalesce(p_notes, '')), 500), v_user, coalesce(p_ai_review_confirmed, false),
    v_kit.lock_version
  )
  returning * into v_version;
  return private.version_json(v_version);
end;
$$;

-- After the snapshot file is written: registers the QR codes, finalizes the version and points
-- the kit at it. Idempotent for an already finalized version.
create function public.publish_finalize(
  p_kit uuid,
  p_version integer,
  p_visibility public.kit_visibility
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
  v_version public.kit_versions;
  v_codes jsonb;
begin
  select * into v_version from public.kit_versions v
  where v.kit_id = p_kit and v.version = p_version
  for update;
  if v_version.kit_id is null then
    perform private.raise('not_found', 'Sürüm bulunamadı.');
  end if;
  if v_version.finalized_at is not null then
    return jsonb_build_object('kit', private.kit_json(v_kit), 'version', private.version_json(v_version));
  end if;

  -- Kit code + one code per card; codes of removed cards stay, inactive.
  v_codes := jsonb_build_array(jsonb_build_object('code', v_kit.qr_prefix, 'stepId', null))
    || coalesce((
      select jsonb_agg(jsonb_build_object('code', s ->> 'qrCode', 'stepId', s ->> 'id'))
      from jsonb_array_elements(v_version.document -> 'steps') s
    ), '[]');
  if exists (
    select 1 from jsonb_array_elements(v_codes) c
    join public.qr_codes q on q.code = c ->> 'code'
    where q.kit_id <> p_kit
  ) then
    perform private.raise('conflict', 'Bu QR kodu başka bir kite ait.');
  end if;
  insert into public.qr_codes (code, kit_id, step_id)
  select c ->> 'code', p_kit, c ->> 'stepId' from jsonb_array_elements(v_codes) c
  on conflict (code) do nothing;
  update public.qr_codes q set
    active = q.code in (select c ->> 'code' from jsonb_array_elements(v_codes) c)
  where q.kit_id = p_kit;

  update public.kit_versions v set finalized_at = now()
  where v.kit_id = p_kit and v.version = p_version
  returning * into v_version;

  -- The working copy equals the published version only if nobody saved meanwhile; a newer draft
  -- (or a review request made meanwhile) keeps its state.
  update public.kits k set
    status = case
      when k.lock_version = v_version.source_lock_version then 'published'::public.kit_status
      when k.status = 'published' then 'draft'::public.kit_status
      else k.status
    end,
    visibility = p_visibility,
    published_version = p_version,
    published_lock_version = v_version.source_lock_version,
    first_published_at = coalesce(k.first_published_at, now()),
    last_published_at = now(),
    review_note = case when k.lock_version = v_version.source_lock_version then null else k.review_note end,
    reviewed_lock_version = case
      when k.lock_version = v_version.source_lock_version then null else k.reviewed_lock_version
    end,
    updated_at = now()
  where k.id = p_kit
  returning * into v_kit;
  perform private.bump_generation();
  perform private.audit('kit.published', 'kit', p_kit::text, jsonb_build_object(
    'version', p_version, 'visibility', p_visibility, 'ai', v_version.ai_review_confirmed
  ), v_user);
  return jsonb_build_object('kit', private.kit_json(v_kit), 'version', private.version_json(v_version));
end;
$$;

create function public.kit_set_visibility(p_kit uuid, p_visibility public.kit_visibility)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
begin
  update public.kits k set visibility = p_visibility, updated_at = now()
  where k.id = p_kit returning * into v_kit;
  perform private.bump_generation();
  perform private.audit('kit.visibility', 'kit', p_kit::text,
    jsonb_build_object('visibility', p_visibility), v_user);
  return private.kit_json(v_kit);
end;
$$;

create function public.kit_archive(p_kit uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.status = 'archived' then return private.kit_json(v_kit); end if;
  update public.kits k set status = 'archived', updated_at = now()
  where k.id = p_kit returning * into v_kit;
  perform private.bump_generation();
  perform private.audit('kit.archived', 'kit', p_kit::text, '{}', v_user);
  return private.kit_json(v_kit);
end;
$$;

-- Back to "published" if the draft equals the live version, otherwise to "draft".
create function public.kit_unarchive(p_kit uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
  v_kit public.kits := private.lock_kit(p_kit);
begin
  if v_kit.status <> 'archived' then return private.kit_json(v_kit); end if;
  update public.kits k set
    status = case
      when k.published_version is not null and k.published_lock_version = k.lock_version
      then 'published'::public.kit_status else 'draft'::public.kit_status end,
    updated_at = now()
  where k.id = p_kit returning * into v_kit;
  perform private.bump_generation();
  perform private.audit('kit.unarchived', 'kit', p_kit::text, '{}', v_user);
  return private.kit_json(v_kit);
end;
$$;

-- "Yayın dosyalarını yeniden oluştur" (after a restore from backup).
create function public.publish_log_regenerated()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_staff(true);
begin
  perform private.audit('published.regenerated', 'published', null, '{}', v_user);
  return private.bump_generation();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Immutability: published snapshots and the QR registry
-- ---------------------------------------------------------------------------------------------

create function private.guard_kit_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Only a reserved version that never went live may go (its kit is being deleted).
    if old.finalized_at is null then return old; end if;
    raise exception 'kit_versions are immutable' using errcode = 'KS409';
  end if;
  if old.finalized_at is not null or new.kit_id <> old.kit_id or new.version <> old.version
    or new.document <> old.document or new.source_lock_version <> old.source_lock_version then
    raise exception 'kit_versions are immutable' using errcode = 'KS409';
  end if;
  return new;
end;
$$;
create trigger kit_versions_immutable
  before update or delete on public.kit_versions
  for each row execute function private.guard_kit_versions();

create function private.guard_qr_codes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.code <> old.code or new.kit_id <> old.kit_id
    or new.step_id is distinct from old.step_id then
    raise exception 'QR codes are never deleted or reassigned' using errcode = 'KS409';
  end if;
  return new;
end;
$$;
create trigger qr_codes_immutable
  before update or delete on public.qr_codes
  for each row execute function private.guard_qr_codes();

grant execute on function
  public.kit_create(uuid, text, text, jsonb, uuid),
  public.kit_save_draft(uuid, jsonb, integer),
  public.kit_rename(uuid, text, text, jsonb, integer),
  public.kit_delete(uuid),
  public.kit_identity_taken(text, text, uuid),
  public.kit_taken_prefixes(),
  public.kit_submit_for_review(uuid, integer),
  public.kit_withdraw_review(uuid),
  public.kit_request_changes(uuid, text),
  public.kit_restore_version(uuid, integer, integer),
  public.publish_acquire_lease(uuid),
  public.publish_release_lease(uuid),
  public.publish_generation(),
  public.publish_reserve_version(uuid, integer, jsonb, text, boolean),
  public.publish_finalize(uuid, integer, public.kit_visibility),
  public.kit_set_visibility(uuid, public.kit_visibility),
  public.kit_archive(uuid),
  public.kit_unarchive(uuid),
  public.publish_log_regenerated()
to authenticated;
