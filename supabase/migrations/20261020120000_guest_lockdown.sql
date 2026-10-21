-- Guests read through guest_view() only (PLAN.md §13, phase 1, part B).
--
-- Pushed only after the app reading guest_view() is live: until then the old app's guests
-- still read the tables directly.
--
-- * The public (anon) key loses SELECT on every wedding table.
-- * Signed-in users read a wedding's rows only if they plan it (including soft-deleted rows,
--   for Recently Deleted). Anyone else, signed in or not, goes through guest_view().
-- * The media bucket becomes private: photos are served through short-lived signed URLs
--   (planners via storage policies, guests via the media Edge Function).

revoke select on table
  public.weddings,
  public.category_definitions,
  public.events,
  public.event_categories,
  public.activities,
  public.activity_images,
  public.activity_links,
  public.payments
from anon;

drop policy "Weddings are readable by everyone" on public.weddings;
create policy "Planners can read their wedding"
  on public.weddings for select
  to authenticated
  using (public.is_planner(id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'category_definitions', 'events', 'event_categories', 'activities', 'activity_images',
    'activity_links', 'payments'
  ]
  loop
    execute format(
      'drop policy "Active rows are readable by everyone; planners also see deleted" '
      'on public.%I',
      t
    );
    execute format(
      'create policy "Planners can read" on public.%I for select to authenticated '
      'using (public.is_planner(wedding_id))',
      t
    );
  end loop;
end;
$$;

update storage.buckets set public = false where id = 'wedding-media';
