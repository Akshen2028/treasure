-- Planners can change their wedding's web address (PLAN.md §13, step 15).
--
-- * Only the slug column is opened up. Row-level security ("Planners can update their
--   wedding", is_planner(id)) limits it to the wedding's own planners, the check constraint
--   keeps the format, and the unique constraint refuses a slug that is taken (23505).
-- * Old addresses are not kept: links with the previous slug stop working (decided
--   2026-10-27). Photos are stored by wedding id, so they are unaffected.
-- * The reserved/offensive slug blocklist comes later (step 18), as a trigger.

grant update (slug) on table public.weddings to authenticated;
