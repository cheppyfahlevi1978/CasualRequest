-- ===========================================================================
-- CASUAL REQUEST — Pin search_path on health_check()
-- The function body is just `select true`, so a mutable search_path cannot
-- actually be exploited here. Pinning it anyway keeps every function in the
-- schema under the same rule and clears the Supabase security linter finding
-- (0011_function_search_path_mutable).
-- ===========================================================================

create or replace function public.health_check()
returns boolean
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select true;
$$;

grant execute on function public.health_check() to anon, authenticated;
