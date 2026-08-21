-- ===========================================================================
-- CASUAL REQUEST — 11. Harden function grants (found by Supabase advisors)
-- Functions created without an explicit REVOKE keep Postgres's default grant
-- of EXECUTE to PUBLIC, so `anon` could call these SECURITY DEFINER business
-- functions over PostgREST even though every one of them fails closed once
-- auth.uid() is null. Revoking PUBLIC/anon here is defense-in-depth, not a
-- fix for an exploitable hole. PRD §63, §65
-- ===========================================================================

revoke execute on function
  public.accessible_hotel_ids(),
  public.assign_casuals(uuid, uuid[]),
  public.bootstrap_hotel_defaults(uuid),
  public.can_read_department_scope(uuid, uuid),
  public.cancel_request(uuid, text),
  public.casual_check_in(uuid, numeric, numeric, text),
  public.casual_check_out(uuid, integer, text),
  public.close_request(uuid),
  public.current_casual_id(),
  public.current_department_id(),
  public.current_role_codes(uuid),
  public.decide_request(uuid, public.approval_decision, text, jsonb),
  public.generate_payments(uuid),
  public.has_hotel_access(uuid),
  public.has_permission(text, uuid),
  public.has_role(text, uuid),
  public.is_active_user(),
  public.is_super_admin(),
  public.mark_attendance(uuid, public.attendance_status, text),
  public.next_request_no(uuid, date),
  public.resolve_approval_steps(uuid, numeric),
  public.set_payment_status(uuid, public.payment_status, text),
  public.shares_hotel_with(uuid),
  public.storage_hotel_id(text),
  public.submit_request(uuid),
  public.unassign_casual(uuid)
from public, anon;

-- Re-affirm the authenticated grant (belt-and-braces; migrations 04/06/08/10
-- already grant these, this just survives if run out of order).
grant execute on function
  public.accessible_hotel_ids(),
  public.assign_casuals(uuid, uuid[]),
  public.bootstrap_hotel_defaults(uuid),
  public.can_read_department_scope(uuid, uuid),
  public.cancel_request(uuid, text),
  public.casual_check_in(uuid, numeric, numeric, text),
  public.casual_check_out(uuid, integer, text),
  public.close_request(uuid),
  public.current_casual_id(),
  public.current_department_id(),
  public.current_role_codes(uuid),
  public.decide_request(uuid, public.approval_decision, text, jsonb),
  public.generate_payments(uuid),
  public.has_hotel_access(uuid),
  public.has_permission(text, uuid),
  public.has_role(text, uuid),
  public.is_active_user(),
  public.is_super_admin(),
  public.mark_attendance(uuid, public.attendance_status, text),
  public.next_request_no(uuid, date),
  public.resolve_approval_steps(uuid, numeric),
  public.set_payment_status(uuid, public.payment_status, text),
  public.shares_hotel_with(uuid),
  public.storage_hotel_id(text),
  public.submit_request(uuid),
  public.unassign_casual(uuid)
to authenticated;

-- Pin search_path on the four functions the linter flagged as mutable.
-- Both are pure (no unqualified table/column references) so this is
-- hardening, not a fix for a live hijack.
create or replace function app.status_for_step(p_step public.approval_step)
returns public.request_status
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_step
    when 'hod'     then 'hod_approval'
    when 'hr'      then 'hr_review'
    when 'finance' then 'finance_verification'
    when 'gm'      then 'gm_approval'
  end::public.request_status;
$$;

create or replace function app.distance_meters(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ))::numeric;
$$;

alter function public.dashboard_summary(uuid, date, date, uuid) set search_path = public, pg_temp;
alter function public.analytics_summary(uuid, date, date) set search_path = public, pg_temp;
