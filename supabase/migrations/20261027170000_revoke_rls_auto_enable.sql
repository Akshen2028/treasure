-- Security Advisor (phase 5, step 20): rls_auto_enable() is Supabase's event-trigger helper that
-- turns on RLS for new tables. It was created outside these migrations and is executable by
-- anon and authenticated. Event-trigger functions can't be called directly, so this only clears
-- the warning; the trigger still fires (Postgres doesn't check EXECUTE when firing it).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
