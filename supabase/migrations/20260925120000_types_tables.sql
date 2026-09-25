-- Kâşif v1 schema (ADR 0021): types, tables, constraints, indexes.
-- Mirrors the mock backend's data model (src/shared/api/mock-tables.ts). Every table has row
-- level security (next migration); nothing here is readable or writable until policies and
-- grants say so. "3 kez planla, 1 kez uygula" (ADR 0016): edited freely until first applied.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'editor');
create type public.kit_status as enum ('draft', 'in_review', 'published', 'archived');
-- unlisted = not in the catalogue, but not secret: its QR codes still open it.
create type public.kit_visibility as enum ('public', 'unlisted');
create type public.activity_type as enum (
  'qr_scan', 'kit_open', 'card_open', 'card_complete',
  'quiz_answer', 'kit_complete', 'badge_earned', 'certificate_view'
);
create type public.media_kind as enum ('image', 'audio', 'captions', 'ai-scene', 'ai-icon', 'icon');

-- ---------------------------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------------------------

-- One row per Studio user; written only by the admin-users Edge Function and definer RPCs.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 60),
  role public.app_role not null,
  active boolean not null default true,
  must_change_password boolean not null default true,
  -- A temporary password is valid for 72 h (set on create and on reset).
  temp_password_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Kits, versions, QR codes
-- ---------------------------------------------------------------------------------------------

create table public.kits (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  qr_prefix text not null unique check (qr_prefix ~ '^[A-Z]{2,4}$'),
  status public.kit_status not null default 'draft',
  visibility public.kit_visibility not null default 'public',
  -- KitDocument (entities/kit). Its identity always matches the row: slug and prefix change
  -- only through rename_kit, which rewrites both.
  draft jsonb not null,
  published_version integer,
  first_published_at timestamptz,
  last_published_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  reviewed_lock_version integer,
  lock_version integer not null default 0,
  published_lock_version integer,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint kits_draft_identity check (
    draft ->> 'id' = id::text and draft ->> 'slug' = slug and draft ->> 'qrPrefix' = qr_prefix
  )
);
create index kits_updated_at_idx on public.kits (updated_at desc);

-- Every prefix a kit ever held: labels may be printed before the first publish, so a prefix is
-- never handed to another kit — not after a rename, not after a delete.
create table public.qr_prefix_reservations (
  prefix text primary key check (prefix ~ '^[A-Z]{2,4}$'),
  kit_id uuid not null,
  reserved_at timestamptz not null default now()
);

-- Immutable published snapshots; only finalized_at is written once (trigger).
create table public.kit_versions (
  kit_id uuid not null references public.kits (id) on delete restrict,
  version integer not null check (version > 0),
  document jsonb not null,
  notes text not null default '' check (char_length(notes) <= 500),
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  ai_review_confirmed boolean not null default false,
  finalized_at timestamptz,
  source_lock_version integer not null,
  primary key (kit_id, version)
);

-- Printed codes: never deleted, never reused (ADR 0013).
create table public.qr_codes (
  code text primary key check (code ~ '^[A-Z]{2,4}(-[0-9]{2,3})?$'),
  kit_id uuid not null references public.kits (id) on delete restrict,
  step_id text check (char_length(step_id) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index qr_codes_kit_idx on public.qr_codes (kit_id);

-- Single row: the generation counter of the published indexes and the publish lease.
create table public.publish_state (
  id smallint primary key default 1 check (id = 1),
  generation bigint not null default 0,
  lease_holder uuid,
  lease_expires_at timestamptz
);
insert into public.publish_state (id) values (1);

-- ---------------------------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  name text not null check (char_length(name) <= 120),
  mime text not null check (char_length(mime) <= 80),
  bytes integer not null check (bytes >= 0),
  width integer,
  height integer,
  duration_sec real,
  alt text not null default '' check (char_length(alt) <= 240),
  -- Object path in the `media` bucket; the public URL is derived from it.
  path text not null unique check (char_length(path) <= 300),
  source text not null check (source in ('upload', 'ai')),
  scene_group uuid,
  scene_state text check (char_length(scene_state) <= 24),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_assets_created_at_idx on public.media_assets (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Kâşif members (ADR 0009, 0017): nickname + avatar only, no personal data
-- ---------------------------------------------------------------------------------------------

create table public.explorers (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar text not null check (avatar in ('indigo', 'teal', 'sun', 'coral', 'leaf', 'berry')),
  display_code text not null check (display_code ~ '^[0-9A-Z]{4}$'),
  settings jsonb not null default '{"sound": true, "reduceMotion": false, "textSize": "normal"}',
  created_via text not null check (created_via in ('self', 'center')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index explorers_last_seen_idx on public.explorers (last_seen_at);

-- The Kâşif kodu hash lives apart from the member row, so no policy on `explorers` can ever
-- expose it. Only definer RPCs read it.
create table public.explorer_secrets (
  explorer_id uuid primary key references public.explorers (id) on delete cascade,
  restore_code_hash text not null unique
);

-- Which anonymous device (auth user) may act for which member.
create table public.explorer_devices (
  explorer_id uuid not null references public.explorers (id) on delete cascade,
  device_uid uuid not null references auth.users (id) on delete cascade,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (explorer_id, device_uid)
);
create index explorer_devices_device_idx on public.explorer_devices (device_uid);

create table public.explorer_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique,
  explorer_id uuid not null references public.explorers (id) on delete cascade,
  kit_id uuid,
  step_id text check (char_length(step_id) <= 40),
  type public.activity_type not null,
  data jsonb not null default '{}',
  is_preview boolean not null default false,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index explorer_events_kit_time_idx on public.explorer_events (kit_id, occurred_at);
create index explorer_events_explorer_time_idx on public.explorer_events (explorer_id, occurred_at);
create index explorer_events_time_idx on public.explorer_events (occurred_at);

create table public.explorer_kit_progress (
  explorer_id uuid not null references public.explorers (id) on delete cascade,
  kit_id uuid not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  completed_steps text[] not null default '{}',
  qr_scans integer not null default 0 check (qr_scans >= 0),
  total_duration_ms bigint not null default 0 check (total_duration_ms >= 0),
  primary key (explorer_id, kit_id)
);

create table public.explorer_badges (
  explorer_id uuid not null references public.explorers (id) on delete cascade,
  badge_id text not null check (char_length(badge_id) <= 80),
  kit_id uuid,
  earned_at timestamptz not null,
  primary key (explorer_id, badge_id)
);

-- Shared centre tablets: one member at a time, educator PIN to leave kiosk mode.
create table public.center_devices (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  setup_code_hash text,
  setup_expires_at timestamptz,
  pin_hash text not null,
  device_uid uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index center_devices_device_uid_idx on public.center_devices (device_uid)
  where device_uid is not null and revoked_at is null;

-- ---------------------------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------------------------

-- Single document (AppSettings in entities/studio); defaults match DEFAULT_APP_SETTINGS.
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id, value) values (1, jsonb_build_object(
  'aiProvider', 'gemini',
  'aiDailyProjectLimit', 200,
  'aiDailyUserLimit', 20,
  'aiSuggestionCount', 1,
  'rawEventRetentionDays', 60,
  'inactiveExplorerMonths', 12,
  'educatorConsentStep', false
));

-- Counters of definer RPCs only (attempt locks, event rate limits).
create table public.rate_limit_counters (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, subject, window_start)
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('scene', 'icon', 'text', 'kit')),
  status text not null check (status in ('ok', 'blocked', 'error')),
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_usage_created_at_idx on public.ai_usage (created_at);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (char_length(action) <= 60),
  entity text not null check (char_length(entity) <= 40),
  entity_id text check (char_length(entity_id) <= 80),
  meta jsonb not null default '{}',
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
