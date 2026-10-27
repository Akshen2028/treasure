-- Fix for 20261027150000_wedding_limits.sql: the blocked-address trigger ran as the planner,
-- who can't execute slug_blocked(), so every web address change failed with 42501. Running
-- it as definer keeps slug_blocked() private while the trigger can use it.

alter function public.weddings_refuse_blocked_slug() security definer;
