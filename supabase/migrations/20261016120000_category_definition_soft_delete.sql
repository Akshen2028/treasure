-- Custom category definitions can be soft-deleted when no event uses them.
--
-- Rules, enforced here regardless of the app:
-- * Default categories can never be deleted.
-- * A category used by any active event category (even one under a deleted event, which would
--   come back if that event were restored) can't be deleted.
-- * A deleted category can't be added to an event.
-- * Restoring an event category whose shared category was deleted restores that category too.
-- * A deleted category's name can be reused.

alter table public.category_definitions add column deleted_at timestamptz;

-- Names only need to be unique among active categories.
drop index public.category_definitions_wedding_name_key;
create unique index category_definitions_wedding_name_key
  on public.category_definitions (wedding_id, lower(btrim(name)))
  where deleted_at is null;

-- Same visibility as other soft-deletable records: guests see active ones, planners see all.
drop policy "Category definitions are readable by everyone" on public.category_definitions;
create policy "Active rows are readable by everyone; planners also see deleted"
  on public.category_definitions for select
  to anon, authenticated
  using (deleted_at is null or public.is_planner(wedding_id));

create function public.guard_category_definition_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if old.is_default then
      raise exception 'Default categories cannot be deleted'
        using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.event_categories ec
      where ec.category_definition_id = old.id
        and ec.deleted_at is null
    ) then
      raise exception 'This category is still used by an event'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger category_definitions_guard_delete
  before update of deleted_at on public.category_definitions
  for each row execute function public.guard_category_definition_delete();

create function public.ensure_category_definition_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null and exists (
    select 1
    from public.category_definitions d
    where d.id = new.category_definition_id
      and d.deleted_at is not null
  ) then
    if tg_op = 'INSERT' then
      raise exception 'This category has been deleted'
        using errcode = '23514';
    end if;
    -- Restoring an event category brings back its shared category. Fails with a unique
    -- violation if another active category has since taken the same name.
    update public.category_definitions
      set deleted_at = null
      where id = new.category_definition_id;
  end if;
  return new;
end;
$$;

create trigger event_categories_ensure_definition_active
  before insert or update of deleted_at, category_definition_id on public.event_categories
  for each row execute function public.ensure_category_definition_active();
