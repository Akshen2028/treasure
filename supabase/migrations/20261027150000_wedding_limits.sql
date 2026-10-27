-- Abuse limits per wedding (PLAN.md §13, step 18), enforced in the database whatever the
-- client sends.
--
-- * Record caps: after each insert statement, the wedding's rows in that table are counted
--   against record_limit(plan, table). Soft-deleted rows count too (they are kept forever, so
--   otherwise create-and-delete could grow a wedding without bound). A per-wedding, per-table
--   advisory lock taken before counting makes parallel inserts see each other's rows.
--   Over the cap: 23514 with a plain-English message the app shows as is.
-- * Photo files: uploads into a wedding's storage folder are refused once it holds
--   record_limit(plan, 'storage_objects') files, so files can't pile up outside the
--   activity_images cap (each photo is a full image plus a thumbnail; covers add one each).
-- * Wedding names are 1 to 100 characters (was 200), trimmed.
-- * Web addresses are 3 to 63 characters, words of letters and digits joined by single
--   hyphens, and not reserved or offensive (slug_blocked(), mirrored by src/domain/slug.ts).
--   slugify() steers around blocked and short results, so create_my_wedding() never fails on
--   them; slug_available() reports them as unavailable.
-- * Existing rows are not re-counted: the caps apply to new rows only. The new check
--   constraints are validated, so this migration fails (and changes nothing) if an existing
--   wedding breaks them.

-- ---------------------------------------------------------------------------
-- Limits per plan
-- ---------------------------------------------------------------------------

-- Rows (or storage files) a wedding may have, per table. Plans other than 'free' don't exist
-- yet; unknown tables get no rows, so a trigger added without a limit fails safe.
create function public.record_limit(p_plan text, p_table text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_table
    when 'events' then 50
    when 'category_definitions' then 100
    when 'event_categories' then 500
    when 'activities' then 2000
    when 'activity_links' then 2000
    when 'activity_images' then 300
    when 'payments' then 5000
    when 'storage_objects' then 800
    else 0
  end;
$$;

-- How the cap message names each table's rows.
create function public.record_limit_noun(p_table text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_table
    when 'events' then 'events'
    when 'category_definitions' then 'categories'
    when 'event_categories' then 'categories across its events'
    when 'activities' then 'activities'
    when 'activity_links' then 'links'
    when 'activity_images' then 'photos'
    when 'payments' then 'payments'
    else 'records'
  end;
$$;

revoke all on function public.record_limit(text, text) from public, anon, authenticated;
revoke all on function public.record_limit_noun(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record caps
-- ---------------------------------------------------------------------------

-- Statement-level, so a bulk insert counts once per wedding instead of once per row.
-- Security definer so the count sees every row whatever the caller's policies.
create function public.enforce_record_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
  v_limit integer;
  v_count bigint;
begin
  for v_wedding_id in select distinct wedding_id from inserted order by wedding_id loop
    perform pg_advisory_xact_lock(
      hashtextextended('record_limit:' || tg_table_name || ':' || v_wedding_id::text, 0)
    );
    select public.record_limit(w.plan, tg_table_name) into v_limit
    from public.weddings w
    where w.id = v_wedding_id;
    execute format('select count(*) from public.%I where wedding_id = $1', tg_table_name)
      into v_count
      using v_wedding_id;
    if v_count > v_limit then
      raise exception 'A wedding can have up to % %',
        to_char(v_limit, 'FM999,999'), public.record_limit_noun(tg_table_name)
        using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.enforce_record_limit() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'events', 'category_definitions', 'event_categories', 'activities',
    'activity_links', 'activity_images', 'payments'
  ] loop
    execute format(
      'create trigger %I after insert on public.%I '
      'referencing new table as inserted for each statement '
      'execute function public.enforce_record_limit()',
      t || '_enforce_record_limit', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photo files in storage
-- ---------------------------------------------------------------------------

-- Whether a planner may add one more file to this wedding's folder. Used by the upload
-- policy below; runs as definer to count every file in the folder.
create function public.media_upload_allowed(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from storage.objects o
    where o.bucket_id = 'wedding-media'
      and o.name like p_wedding_id::text || '/%'
  ) < (
    select public.record_limit(w.plan, 'storage_objects')
    from public.weddings w
    where w.id = p_wedding_id
  );
$$;

revoke all on function public.media_upload_allowed(uuid) from public, anon;
grant execute on function public.media_upload_allowed(uuid) to authenticated;

drop policy "Planners can upload media to their wedding's folder" on storage.objects;
create policy "Planners can upload media to their wedding's folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wedding-media'
    and public.is_planner(public.storage_object_wedding_id(name))
    and public.media_upload_allowed(public.storage_object_wedding_id(name))
  );

-- ---------------------------------------------------------------------------
-- Wedding names and web addresses
-- ---------------------------------------------------------------------------

alter table public.weddings drop constraint weddings_name_check;
alter table public.weddings add constraint weddings_name_check
  check (char_length(btrim(name)) between 1 and 100);


-- Reserved addresses (the whole slug). Same list as RESERVED_SLUGS in src/domain/slug.ts.
create function public.slug_reserved(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    -- reserved:start
    'about', 'account', 'accounts', 'admin', 'administrator', 'api', 'app', 'auth',
    'billing', 'blog', 'create', 'dashboard', 'demo', 'docs', 'edit', 'email', 'example',
    'help', 'home', 'login', 'logout', 'mail', 'mywedonomics', 'new', 'null', 'official',
    'planner', 'privacy', 'root', 'search', 'security', 'settings', 'sign-in', 'sign-up',
    'signin', 'signup', 'staff', 'status', 'support', 'system', 'terms', 'test',
    'undefined', 'w', 'wedonomics', 'www'
    -- reserved:end
  ]);
$$;

-- Offensive words (any hyphen-separated word, so "scunthorpe" stays fine). Same list as
-- BLOCKED_SLUG_WORDS in src/domain/slug.ts.
create function public.slug_offensive(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select string_to_array(p_slug, '-') && array[
    -- offensive:start
    'asshole', 'bastard', 'bitch', 'chink', 'cock', 'cunt', 'dyke', 'fag', 'faggot',
    'fuck', 'fucker', 'fucking', 'hitler', 'kike', 'kkk', 'nazi', 'nigga', 'nigger',
    'porn', 'pussy', 'rape', 'rapist', 'retard', 'shit', 'slut', 'spic', 'tranny',
    'wetback', 'whore'
    -- offensive:end
  ];
$$;

create function public.slug_blocked(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.slug_reserved(p_slug) or public.slug_offensive(p_slug);
$$;

revoke all on function public.slug_reserved(text) from public, anon, authenticated;
revoke all on function public.slug_offensive(text) from public, anon, authenticated;
revoke all on function public.slug_blocked(text) from public, anon, authenticated;

alter table public.weddings drop constraint weddings_slug_check;
alter table public.weddings add constraint weddings_slug_check
  check (char_length(slug) between 3 and 63 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Blocked addresses can't be created or moved to. A trigger, not a check constraint, so the
-- lists can change later without re-validating addresses already in use.
create function public.weddings_refuse_blocked_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
    and public.slug_blocked(new.slug) then
    raise exception 'That web address isn’t available' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.weddings_refuse_blocked_slug() from public, anon, authenticated;

create trigger weddings_refuse_blocked_slug
  before insert or update of slug on public.weddings
  for each row execute function public.weddings_refuse_blocked_slug();

-- As before, then: an address with an offensive word becomes 'wedding'; one that is too short
-- or reserved gets '-wedding' added. Mirrors slugify() in src/domain/slug.ts.
create or replace function public.slugify(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when base = '' or public.slug_offensive(base) then 'wedding'
    when char_length(base) < 3 or public.slug_reserved(base) then base || '-wedding'
    else base
  end
  from (
    select coalesce(regexp_replace(
      left(
        trim(both '-' from regexp_replace(
          regexp_replace(lower(normalize(p_name, nfd)), '[̀-ͯ]', '', 'g'),
          '[^a-z0-9]+', '-', 'g'
        )),
        50
      ),
      '-+$', ''
    ), '') as base
  ) s;
$$;

-- Same rules as the weddings.slug check constraint and the blocked-address trigger.
create or replace function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select char_length(p_slug) between 3 and 63
    and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and not public.slug_blocked(p_slug)
    and not exists (select 1 from public.weddings w where w.slug = p_slug);
$$;

-- Names are now 1 to 100 characters; otherwise unchanged.
create or replace function public.create_my_wedding(p_name text, p_wedding_date date default null)
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
  if v_name is null or char_length(v_name) not between 1 and 100 then
    raise exception 'The wedding name must be 1 to 100 characters' using errcode = '22023';
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
