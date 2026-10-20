-- Visibility, share links and the guest view (PLAN.md §13, phase 1).
--
-- * Each wedding is Public (anyone can view; listed in search) or Private (only people with
--   its share link can view). New weddings default to Private; 'main' becomes Public.
-- * A share link carries share_key, a random 128-bit hex string. Slugs are guessable; the key
--   is not. Planners can reset it, which stops old links working.
-- * guest_amounts decides what guests see: real amounts, or percentages of the wedding's total
--   budget (computed here, so raw amounts never leave the database in that mode).
-- * plan is server-only ('free' for now); later a payment webhook sets it.
--
-- Guests read through guest_view() only. This migration is additive: the existing "readable
-- by everyone" table policies are removed in the next migration, once the app no longer
-- relies on them.

create type public.wedding_visibility as enum ('public', 'private');
create type public.guest_amounts as enum ('amounts', 'percentages');

-- A fresh random key: 32 hex characters from a v4 UUID (122 random bits).
create function public.new_share_key()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

revoke all on function public.new_share_key() from public, anon, authenticated;

alter table public.weddings
  add column visibility public.wedding_visibility not null default 'private',
  add column share_key text not null default public.new_share_key()
    check (share_key ~ '^[0-9a-f]{32}$'),
  add column guest_amounts public.guest_amounts not null default 'amounts',
  add column plan text not null default 'free' check (plan in ('free'));

update public.weddings set visibility = 'public' where slug = 'main';

-- Planners choose visibility and what guests see. share_key changes only through
-- reset_share_key(); plan never changes from the browser.
grant update (visibility, guest_amounts) on table public.weddings to authenticated;

-- ---------------------------------------------------------------------------
-- Who may view a wedding
-- ---------------------------------------------------------------------------

-- The wedding's id if the caller may view it: it is public, the share key matches, or the
-- caller is one of its planners. Null otherwise, so a private wedding is indistinguishable
-- from one that doesn't exist.
create function public.viewable_wedding_id(p_slug text, p_share_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.id
  from public.weddings w
  where w.slug = p_slug
    and (
      w.visibility = 'public'
      or (p_share_key is not null and w.share_key = p_share_key)
      or public.is_planner(w.id)
    );
$$;

revoke all on function public.viewable_wedding_id(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Budget shares for percentage mode
-- ---------------------------------------------------------------------------

-- An amount as parts per million of the wedding's total budget, rounded half up. 0 when the
-- total is 0. Mirrors budgetShare() in src/domain/guestFigures.ts.
create function public.budget_share(amount bigint, total bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  -- numeric throughout: amount × 2,000,000 can exceed bigint.
  select case when total > 0
    then floor((amount::numeric * 2000000 + total) / (2 * total::numeric))::bigint
    else 0 end;
$$;

revoke all on function public.budget_share(bigint, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- guest_view(): everything a guest may see, as one JSON document
-- ---------------------------------------------------------------------------

-- Returns null if the wedding doesn't exist or the caller may not view it. Otherwise:
--   wedding: public settings only (never share_key or plan);
--   category_definitions, events, event_categories, activities, activity_images,
--   activity_links, payments: active rows whose ancestors are active, as table rows;
--   figures: null in amounts mode. In percentages mode every money column is blanked
--     (0, or null for actual cost; payment notes too) and figures holds each level's budget,
--     paid and child budgets as parts per million of the wedding total, plus exact
--     over-budget flags. Mirrors computeGuestFigures() in src/domain/guestFigures.ts.
create function public.guest_view(p_slug text, p_share_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_wedding public.weddings;
  v_percent boolean;
  v_result jsonb;
begin
  select * into v_wedding
  from public.weddings
  where id = public.viewable_wedding_id(p_slug, p_share_key);
  if not found then
    return null;
  end if;
  v_percent := v_wedding.guest_amounts = 'percentages';

  with
  defs as (
    select * from public.category_definitions
    where wedding_id = v_wedding.id and deleted_at is null
  ),
  evts as (
    select * from public.events
    where wedding_id = v_wedding.id and deleted_at is null
  ),
  cats as (
    select * from public.event_categories
    where wedding_id = v_wedding.id and deleted_at is null
      and event_id in (select id from evts)
      and category_definition_id in (select id from defs)
  ),
  acts as (
    select * from public.activities
    where wedding_id = v_wedding.id and deleted_at is null
      and event_category_id in (select id from cats)
  ),
  pays as (
    select * from public.payments
    where wedding_id = v_wedding.id and deleted_at is null
      and activity_id in (select id from acts)
  ),
  imgs as (
    select * from public.activity_images
    where wedding_id = v_wedding.id and deleted_at is null
      and activity_id in (select id from acts)
  ),
  lnks as (
    select * from public.activity_links
    where wedding_id = v_wedding.id and deleted_at is null
      and activity_id in (select id from acts)
  ),
  -- Budget rules from src/domain/budget.ts: activities have their own budget; every level
  -- above uses its manual amount in manual mode, else the sum of its children's budgets.
  -- Paid always rolls up from payments.
  act_fig as (
    select a.id, a.event_category_id, a.budget_cents as budget,
           coalesce(sum(p.amount_cents), 0)::bigint as paid, count(p.id) as payment_count
    from acts a
    left join pays p on p.activity_id = a.id
    group by a.id, a.event_category_id, a.budget_cents
  ),
  cat_sum as (
    select c.id, c.event_id, c.manual_budget_cents,
           coalesce(sum(f.budget), 0)::bigint as child, coalesce(sum(f.paid), 0)::bigint as paid
    from cats c
    left join act_fig f on f.event_category_id = c.id
    group by c.id, c.event_id, c.manual_budget_cents
  ),
  cat_fig as (
    select id, event_id, child, paid,
           case when v_wedding.budget_mode = 'manual' then manual_budget_cents else child end
             as budget
    from cat_sum
  ),
  evt_sum as (
    select e.id, e.manual_budget_cents,
           coalesce(sum(f.budget), 0)::bigint as child, coalesce(sum(f.paid), 0)::bigint as paid
    from evts e
    left join cat_fig f on f.event_id = e.id
    group by e.id, e.manual_budget_cents
  ),
  evt_fig as (
    select id, child, paid,
           case when v_wedding.budget_mode = 'manual' then manual_budget_cents else child end
             as budget
    from evt_sum
  ),
  wed_fig as (
    select x.child, x.paid,
           case when v_wedding.budget_mode = 'manual' then v_wedding.manual_budget_cents
                else x.child end as budget
    from (
      select coalesce(sum(budget), 0)::bigint as child, coalesce(sum(paid), 0)::bigint as paid
      from evt_fig
    ) x
  )
  select jsonb_build_object(
    'wedding', jsonb_build_object(
      'id', v_wedding.id,
      'slug', v_wedding.slug,
      'name', v_wedding.name,
      'wedding_date', v_wedding.wedding_date,
      'budget_mode', v_wedding.budget_mode,
      'manual_budget_cents', case when v_percent then 0 else v_wedding.manual_budget_cents end,
      'visibility', v_wedding.visibility,
      'guest_amounts', v_wedding.guest_amounts,
      'created_at', v_wedding.created_at,
      'updated_at', v_wedding.updated_at
    ),
    'category_definitions', coalesce(
      (select jsonb_agg(to_jsonb(d) order by d.created_at, d.id) from defs d), '[]'),
    'events', coalesce(
      (select jsonb_agg(
         case when v_percent then to_jsonb(e) || '{"manual_budget_cents": 0}' else to_jsonb(e) end
         order by e.created_at, e.id)
       from evts e), '[]'),
    'event_categories', coalesce(
      (select jsonb_agg(
         case when v_percent then to_jsonb(c) || '{"manual_budget_cents": 0}' else to_jsonb(c) end
         order by c.created_at, c.id)
       from cats c), '[]'),
    'activities', coalesce(
      (select jsonb_agg(
         case when v_percent
           then to_jsonb(a) || '{"budget_cents": 0, "actual_cost_cents": null}'
           else to_jsonb(a) end
         order by a.created_at, a.id)
       from acts a), '[]'),
    'activity_images', coalesce(
      (select jsonb_agg(to_jsonb(i) order by i.created_at, i.id) from imgs i), '[]'),
    'activity_links', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.created_at, l.id) from lnks l), '[]'),
    'payments', coalesce(
      (select jsonb_agg(
         case when v_percent then to_jsonb(p) || '{"amount_cents": 0, "note": ""}'
           else to_jsonb(p) end
         order by p.created_at, p.id)
       from pays p), '[]'),
    'figures', case when v_percent then (
      select jsonb_build_object(
        'wedding', jsonb_build_object(
          'budget', public.budget_share(w.budget, w.budget),
          'paid', public.budget_share(w.paid, w.budget),
          'child', public.budget_share(w.child, w.budget),
          'over', w.paid > w.budget
        ),
        'events', coalesce(
          (select jsonb_object_agg(f.id, jsonb_build_object(
             'budget', public.budget_share(f.budget, w.budget),
             'paid', public.budget_share(f.paid, w.budget),
             'child', public.budget_share(f.child, w.budget),
             'over', f.paid > f.budget))
           from evt_fig f), '{}'),
        'categories', coalesce(
          (select jsonb_object_agg(f.id, jsonb_build_object(
             'budget', public.budget_share(f.budget, w.budget),
             'paid', public.budget_share(f.paid, w.budget),
             'child', public.budget_share(f.child, w.budget),
             'over', f.paid > f.budget))
           from cat_fig f), '{}'),
        'activities', coalesce(
          (select jsonb_object_agg(f.id, jsonb_build_object(
             'budget', public.budget_share(f.budget, w.budget),
             'paid', public.budget_share(f.paid, w.budget),
             'over', f.paid > f.budget,
             'payments', f.payment_count))
           from act_fig f), '{}')
      )
      from wed_fig w
    ) end
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.guest_view(text, text) from public;
grant execute on function public.guest_view(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- search_weddings(): find Public weddings by name or slug
-- ---------------------------------------------------------------------------

-- At least 3 characters, at most 10 results. Private weddings are never returned.
create function public.search_weddings(q text)
returns table (name text, wedding_date date, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    -- Match the text literally: escape LIKE wildcards.
    select replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as t
    where char_length(btrim(q)) between 3 and 100
  )
  select w.name, w.wedding_date, w.slug
  from public.weddings w, term
  where w.visibility = 'public'
    and (w.name ilike '%' || term.t || '%' or w.slug ilike '%' || term.t || '%')
  order by w.name, w.slug
  limit 10;
$$;

revoke all on function public.search_weddings(text) from public;
grant execute on function public.search_weddings(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reset_share_key(): planners issue a new share link; old links stop working
-- ---------------------------------------------------------------------------

create function public.reset_share_key(p_wedding_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if not public.is_planner(p_wedding_id) then
    raise exception 'Only planners can reset the share link' using errcode = '42501';
  end if;
  update public.weddings
    set share_key = public.new_share_key()
    where id = p_wedding_id
    returning share_key into v_key;
  return v_key;
end;
$$;

revoke all on function public.reset_share_key(uuid) from public, anon;
grant execute on function public.reset_share_key(uuid) to authenticated;
