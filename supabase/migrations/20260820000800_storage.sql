-- ===========================================================================
-- CASUAL REQUEST — 08. Supabase Storage buckets and policies
-- PRD §22, §23, §39, §67
-- Object path convention: {hotel_code}/{entity}/{entity_id}/{kind}/{file}
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Staff avatars are not public: they are served through short-lived signed
  -- URLs so a leaked object path does not expose the internal directory.
  ('profile-images', 'profile-images', false, 5242880,
    array['image/jpeg','image/png','image/webp']),
  ('hotel-assets', 'hotel-assets', true, 10485760,
    array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('casual-request-private', 'casual-request-private', false, 20971520,
    array['image/jpeg','image/png','image/webp','application/pdf']),
  ('report-exports', 'report-exports', false, 52428800,
    array['text/csv','application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Resolve the hotel that owns an object from the first path segment.
create or replace function public.storage_hotel_id(p_path text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select h.id
  from public.hotels h
  where h.code = split_part(coalesce(p_path, ''), '/', 1)
    and h.deleted_at is null
  limit 1;
$$;

grant execute on function public.storage_hotel_id(text) to authenticated;

-- --- casual-request-private: KTP, CV, certificates, evidence, agreements ---
drop policy if exists cr_private_read on storage.objects;
create policy cr_private_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'casual-request-private'
    and (
      public.has_permission('document.read', public.storage_hotel_id(name))
      -- A casual worker may read files stored under their own casual id.
      or (
        public.current_casual_id() is not null
        and (storage.foldername(name))[3] = public.current_casual_id()::text
      )
    )
  );

drop policy if exists cr_private_insert on storage.objects;
create policy cr_private_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'casual-request-private'
    and public.has_permission('document.manage', public.storage_hotel_id(name))
  );

drop policy if exists cr_private_update on storage.objects;
create policy cr_private_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'casual-request-private'
    and public.has_permission('document.manage', public.storage_hotel_id(name))
  )
  with check (
    bucket_id = 'casual-request-private'
    and public.has_permission('document.manage', public.storage_hotel_id(name))
  );

drop policy if exists cr_private_delete on storage.objects;
create policy cr_private_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'casual-request-private'
    and public.has_permission('document.manage', public.storage_hotel_id(name))
  );

-- --- profile-images: path is {auth_user_id}/{file} -------------------------
drop policy if exists profile_images_read on storage.objects;
create policy profile_images_read on storage.objects
  for select to authenticated using (bucket_id = 'profile-images');

drop policy if exists profile_images_write on storage.objects;
create policy profile_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('user.manage', null)
    )
  );

drop policy if exists profile_images_update on storage.objects;
create policy profile_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('user.manage', null)
    )
  )
  with check (bucket_id = 'profile-images');

drop policy if exists profile_images_delete on storage.objects;
create policy profile_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('user.manage', null)
    )
  );

-- --- hotel-assets: logos and cover photos ----------------------------------
drop policy if exists hotel_assets_read on storage.objects;
create policy hotel_assets_read on storage.objects
  for select to authenticated using (bucket_id = 'hotel-assets');

drop policy if exists hotel_assets_write on storage.objects;
create policy hotel_assets_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'hotel-assets'
    and public.has_permission('hotel.manage', public.storage_hotel_id(name))
  )
  with check (
    bucket_id = 'hotel-assets'
    and public.has_permission('hotel.manage', public.storage_hotel_id(name))
  );

-- --- report-exports: generated server-side, read by report consumers -------
drop policy if exists report_exports_read on storage.objects;
create policy report_exports_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-exports'
    and public.has_permission('report.export', public.storage_hotel_id(name))
  );
