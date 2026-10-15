-- Wedonomics media storage.
--
-- One public bucket. Guests view images through public URLs (no policy needed for that).
-- Object paths start with the wedding id: {wedding_id}/activities/{activity_id}/{uuid}.webp
-- or {wedding_id}/events/{event_id}/{uuid}.webp. Only that wedding's planners may upload,
-- replace or remove objects in its folder.
--
-- The bucket enforces the size and type limits server-side, whatever the browser sends.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-media',
  'wedding-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Wedding id from the first folder of an object path, or null if it is not a uuid.
create function public.storage_object_wedding_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
  end;
$$;

revoke all on function public.storage_object_wedding_id(text) from public;
grant execute on function public.storage_object_wedding_id(text) to anon, authenticated;

create policy "Planners can read their wedding's media objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
  );

create policy "Planners can upload media to their wedding's folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
  );

create policy "Planners can replace media in their wedding's folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
  )
  with check (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
  );

-- Used to clean up an upload whose database record failed to save, and to replace covers.
create policy "Planners can remove media from their wedding's folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
  );
