-- Wedonomics access control.
--
-- Roles
-- * Guests use the public (anon) key: read-only access to every wedding's active records.
-- * Planners are signed-in users listed in public.planners for a wedding: they may read
--   everything in that wedding (including soft-deleted records) and insert/update it.
-- * Any other signed-in user has guest access only.
-- * Nobody can hard-delete through the API. Deletion is an update of deleted_at.
--   Only privileged server-side scripts (secret key) can hard-delete, e.g. test cleanup.
--
-- Defence in depth: table privileges are granted per role first (anon can only SELECT), then
-- row-level security policies decide which rows each role may touch.

-- ---------------------------------------------------------------------------
-- is_planner(): the single permission check used by every policy
-- ---------------------------------------------------------------------------

-- Security definer so policies can consult public.planners without exposing it.
-- search_path is pinned to prevent hijacking; auth.uid() is wrapped in a sub-select so
-- Postgres evaluates it once per statement rather than once per row.
create function public.is_planner(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.planners p
    where p.wedding_id = target_wedding_id
      and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_planner(uuid) from public;
grant execute on function public.is_planner(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

-- Start from nothing, then grant only what each role needs.
revoke all on table
  public.weddings,
  public.planners,
  public.category_definitions,
  public.events,
  public.event_categories,
  public.activities,
  public.activity_images,
  public.activity_links,
  public.payments
from anon, authenticated;

grant select on table
  public.weddings,
  public.category_definitions,
  public.events,
  public.event_categories,
  public.activities,
  public.activity_images,
  public.activity_links,
  public.payments
to anon, authenticated;

-- Signed-in users may read their own planner memberships; nobody can change them via the API.
grant select on table public.planners to authenticated;

-- Writes: signed-in users only, and row-level security limits them to planners.
-- No DELETE or TRUNCATE is granted to anyone.
grant update (name, wedding_date, budget_mode, manual_budget_cents)
  on table public.weddings to authenticated;
grant insert, update on table
  public.category_definitions,
  public.events,
  public.event_categories,
  public.activities,
  public.activity_images,
  public.activity_links,
  public.payments
to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.weddings enable row level security;
alter table public.planners enable row level security;
alter table public.category_definitions enable row level security;
alter table public.events enable row level security;
alter table public.event_categories enable row level security;
alter table public.activities enable row level security;
alter table public.activity_images enable row level security;
alter table public.activity_links enable row level security;
alter table public.payments enable row level security;

-- Weddings: readable by all; planners may update settings. Created only by scripts.
create policy "Weddings are readable by everyone"
  on public.weddings for select
  to anon, authenticated
  using (true);

create policy "Planners can update their wedding"
  on public.weddings for update
  to authenticated
  using (public.is_planner(id))
  with check (public.is_planner(id));

-- Planners: each user can see their own memberships (lets the app confirm planner status).
create policy "Users can read their own planner memberships"
  on public.planners for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Category definitions: readable by all; planners may add and rename.
create policy "Category definitions are readable by everyone"
  on public.category_definitions for select
  to anon, authenticated
  using (true);

create policy "Planners can add category definitions"
  on public.category_definitions for insert
  to authenticated
  with check (public.is_planner(wedding_id));

create policy "Planners can update category definitions"
  on public.category_definitions for update
  to authenticated
  using (public.is_planner(wedding_id))
  with check (public.is_planner(wedding_id));

-- Soft-deletable tables share one pattern:
-- * everyone reads active rows; planners also read soft-deleted rows (Recently Deleted);
-- * planners insert and update (including setting or clearing deleted_at).
do $$
declare
  t text;
begin
  foreach t in array array[
    'events', 'event_categories', 'activities', 'activity_images', 'activity_links', 'payments'
  ]
  loop
    execute format(
      'create policy "Active rows are readable by everyone; planners also see deleted" '
      'on public.%I for select to anon, authenticated '
      'using (deleted_at is null or public.is_planner(wedding_id))',
      t
    );
    execute format(
      'create policy "Planners can insert" on public.%I for insert to authenticated '
      'with check (public.is_planner(wedding_id))',
      t
    );
    execute format(
      'create policy "Planners can update" on public.%I for update to authenticated '
      'using (public.is_planner(wedding_id)) with check (public.is_planner(wedding_id))',
      t
    );
  end loop;
end;
$$;
