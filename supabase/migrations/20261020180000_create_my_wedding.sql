-- One-step wedding creation (PLAN.md §13, phase 2, step 10).
--
-- A signed-in user with no wedding calls create_my_wedding(name, date): it inserts the wedding
-- (with a unique slug made from the name) and makes the caller its planner, in one transaction.
-- Clients still cannot insert into weddings or planners directly. Public sign-ups stay disabled
-- until launch, so for now only existing accounts can call it.

-- ---------------------------------------------------------------------------
-- slugify(): the readable part of a wedding's address
-- ---------------------------------------------------------------------------

-- Lower-case ASCII letters and digits joined by single hyphens, accents dropped, at most 50
-- characters (room for a numeric suffix); 'wedding' if nothing is left. Mirrors slugify() in
-- src/domain/slug.ts.
create function public.slugify(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      regexp_replace(
        left(
          trim(both '-' from regexp_replace(
            regexp_replace(lower(normalize(p_name, nfd)), '[̀-ͯ]', '', 'g'),
            '[^a-z0-9]+', '-', 'g'
          )),
          50
        ),
        '-+$', ''
      ),
      ''
    ),
    'wedding'
  );
$$;

revoke all on function public.slugify(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_my_wedding(): a new wedding with the caller as its planner
-- ---------------------------------------------------------------------------

-- One wedding per account: refused (23505) if the caller already plans one. The slug is
-- slugify(name), then name-2, name-3, … if taken. The wedding is Private with a fresh share
-- key and the default categories (column defaults and the existing insert trigger).
create function public.create_my_wedding(p_name text, p_wedding_date date default null)
returns public.weddings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_name);
  v_base text;
  v_slug text;
  v_attempt integer := 0;
  v_wedding public.weddings;
begin
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in to create a wedding' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 200 then
    raise exception 'The wedding name must be 1 to 200 characters' using errcode = '22023';
  end if;

  -- Serialise each user's calls so two at once can't both pass the one-wedding check.
  perform pg_advisory_xact_lock(hashtextextended('create_my_wedding:' || v_user::text, 0));
  if exists (select 1 from public.planners where user_id = v_user) then
    raise exception 'You already have a wedding' using errcode = '23505';
  end if;

  v_base := public.slugify(v_name);
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 10000 then
      raise exception 'Could not find a free address for this wedding' using errcode = '23505';
    end if;
    v_slug := case when v_attempt = 1 then v_base else v_base || '-' || v_attempt end;
    continue when exists (select 1 from public.weddings where slug = v_slug);
    begin
      insert into public.weddings (slug, name, wedding_date)
      values (v_slug, v_name, p_wedding_date)
      returning * into v_wedding;
      exit;
    exception when unique_violation then
      -- Taken by a concurrent call since the check: try the next number.
      null;
    end;
  end loop;

  insert into public.planners (user_id, wedding_id) values (v_user, v_wedding.id);
  return v_wedding;
end;
$$;

revoke all on function public.create_my_wedding(text, date) from public, anon;
grant execute on function public.create_my_wedding(text, date) to authenticated;
