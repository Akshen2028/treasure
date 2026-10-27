-- AI usage limit per wedding (PLAN.md §13, step 17). The `chat` Edge Function counts each
-- question before calling Claude and refuses once the wedding's daily limit is reached.
--
-- * ai_usage holds one row per wedding per day. Server-write only: RLS is on with no
--   policies, and API roles other than service_role have no privileges on it.
-- * The day is the America/Toronto calendar day, so the count resets at local midnight.
-- * The limit depends on the wedding's server-only plan ('free' = 30 a day).
-- * use_ai_question() is the only writer, executable by service_role only (the chat function
--   calls it with the service role key after its own planner check). It counts and checks
--   in one statement, so parallel requests can't go over the limit.
-- * ai_usage_today() lets planners see how many questions are left; it reads only their own
--   wedding's count and changes nothing.

create table public.ai_usage (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  day date not null,
  questions integer not null check (questions > 0),
  primary key (wedding_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from public, anon, authenticated;

-- Questions a day per plan. Plans other than 'free' don't exist yet.
create function public.ai_daily_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'free' then 30 else 30 end;
$$;

create function public.ai_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Toronto')::date;
$$;

-- Counts one question if the wedding is under today's limit. Returns whether it was counted,
-- the questions used today (including this one) and the limit.
create function public.use_ai_question(p_wedding_id uuid)
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  select public.ai_daily_limit(w.plan) into v_limit
  from public.weddings w
  where w.id = p_wedding_id;
  if v_limit is null then
    raise exception 'Wedding not found' using errcode = 'P0002';
  end if;

  insert into public.ai_usage as u (wedding_id, day, questions)
  values (p_wedding_id, public.ai_today(), 1)
  on conflict (wedding_id, day) do update
    set questions = u.questions + 1
    where u.questions < v_limit
  returning u.questions into v_used;

  if v_used is null then
    -- At the limit: the conflicting row wasn't updated.
    return query select false, v_limit, v_limit;
  else
    return query select true, v_used, v_limit;
  end if;
end;
$$;

-- Today's count for a wedding the caller plans.
create function public.ai_usage_today(p_wedding_id uuid)
returns table (used integer, daily_limit integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_planner(p_wedding_id) then
    raise exception 'Only planners can see AI usage' using errcode = '42501';
  end if;
  return query
    select
      coalesce(
        (select u.questions from public.ai_usage u
         where u.wedding_id = p_wedding_id and u.day = public.ai_today()),
        0
      ),
      public.ai_daily_limit(w.plan)
    from public.weddings w
    where w.id = p_wedding_id;
end;
$$;

revoke all on function public.ai_daily_limit(text) from public, anon, authenticated;
revoke all on function public.ai_today() from public, anon, authenticated;
revoke all on function public.use_ai_question(uuid) from public, anon, authenticated;
revoke all on function public.ai_usage_today(uuid) from public, anon;
grant select, insert, update on table public.ai_usage to service_role;
grant execute on function public.ai_daily_limit(text) to service_role;
grant execute on function public.ai_today() to service_role;
grant execute on function public.use_ai_question(uuid) to service_role;
grant execute on function public.ai_usage_today(uuid) to authenticated;
