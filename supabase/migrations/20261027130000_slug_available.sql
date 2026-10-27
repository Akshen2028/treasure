-- slug_available(): live "is this web address free?" check for the Settings form (PLAN.md §13,
-- step 15). Planners can't read other weddings' rows, so the check runs as security definer.
--
-- * Returns only true/false: no names, ids or visibility. Slugs are guessable by design (a
--   Private wedding is protected by its share key, not its slug), and saving a taken slug
--   already fails with 23505, so this reveals nothing new.
-- * Signed-in users only. Badly formed slugs return false (they can't be saved either).
-- * Advisory: the unique constraint on weddings.slug still decides when the planner saves.

create function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'
    and not exists (select 1 from public.weddings w where w.slug = p_slug);
$$;

revoke all on function public.slug_available(text) from public, anon;
grant execute on function public.slug_available(text) to authenticated;
