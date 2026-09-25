-- Storage (ADR 0020): three public buckets, readable by URL, never listable by visitors.
--   media      uploads/<id>.<ext> by staff (webp/png/jpeg, mpeg/mp4 audio, VTT; no SVG, no video)
--   ai         AI drawings (SVG, checked by checkAiSvg), written only by the ai-generate function
--              with the service role — staff can never store an SVG of their own
--   published  catalog.json, qr-index.json, kits/<slug>/latest.json and v<n>.json, written by
--              the admin's publishing saga (ADR 0021); kids read them without a session

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 1048576, array[
    'image/webp', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'text/vtt'
  ]),
  ('ai', 'ai', true, 16384, array['image/svg+xml']),
  ('published', 'published', true, 5242880, array['application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Staff may see the objects of both buckets (needed for delete and upsert); visitors fetch by
-- URL only, so there is no policy for anon.
create policy kasif_staff_read on storage.objects for select to authenticated
  using (bucket_id in ('media', 'ai', 'published') and private.is_active_staff());

create policy kasif_media_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and name like 'uploads/%' and private.is_active_staff()
  );

create policy kasif_media_delete on storage.objects for delete to authenticated
  using (
    ((bucket_id = 'media' and name like 'uploads/%') or bucket_id = 'ai') and private.is_admin()
  );

-- An upload whose registration failed may be removed by the staff member who made it (it has no
-- media_assets row yet, so nothing can use it).
create policy kasif_media_delete_own_orphan on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and name like 'uploads/%' and owner = auth.uid()
    and private.is_active_staff()
    -- storage.objects.name, qualified: media_assets has a "name" column too.
    and not exists (select 1 from public.media_assets m where m.path = storage.objects.name)
  );

create policy kasif_published_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'published' and private.is_admin());

create policy kasif_published_update on storage.objects for update to authenticated
  using (bucket_id = 'published' and private.is_admin())
  with check (bucket_id = 'published' and private.is_admin());

create policy kasif_published_delete on storage.objects for delete to authenticated
  using (bucket_id = 'published' and private.is_admin());
