-- ===========================================================================
-- CASUAL REQUEST — 13. Health-check RPC (PRD §70)
-- Migration 07 revokes every table grant from `anon` (correct: anonymous
-- callers must never read application data). That leaves /api/health with no
-- way to prove the database is reachable using the public anon key, since a
-- direct table query fails on privilege, not on RLS, and always reports
-- "error" even when the database is perfectly healthy. This function proves
-- connectivity only: it takes no input, returns no data, and is granted to
-- anon deliberately (nothing else in this schema is).
-- ===========================================================================

create or replace function public.health_check()
returns boolean
language sql
stable
as $$
  select true;
$$;

grant execute on function public.health_check() to anon, authenticated;
