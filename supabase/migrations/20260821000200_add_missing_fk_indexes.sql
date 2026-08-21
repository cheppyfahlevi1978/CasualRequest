-- ===========================================================================
-- CASUAL REQUEST — 12. Missing foreign-key indexes (found by Supabase advisors)
-- Only foreign keys that real query patterns actually filter or join on are
-- indexed here (PRD §52). Pure audit trail columns (created_by, updated_by,
-- deleted_by, verified_by, approved_by, paid_by, released_by, changed_by) are
-- deliberately left unindexed: they are shown, not filtered on, and an index
-- there would just be write overhead with no read benefit.
-- ===========================================================================

create index if not exists assignments_department_idx on public.assignments (department_id);
create index if not exists assignments_shift_idx on public.assignments (shift_id);
create index if not exists attendance_request_idx on public.attendance (request_id);
create index if not exists attendance_shift_idx on public.attendance (shift_id);
create index if not exists budgets_department_idx on public.budgets (department_id);
create index if not exists casual_requests_shift_idx on public.casual_requests (shift_id);
create index if not exists documents_assignment_idx on public.documents (assignment_id);
create index if not exists documents_profile_idx on public.documents (profile_id);
create index if not exists evaluations_department_idx on public.evaluations (department_id);
create index if not exists evaluations_request_idx on public.evaluations (request_id);
create index if not exists notifications_hotel_idx on public.notifications (hotel_id);
create index if not exists payments_request_idx on public.payments (request_id);
create index if not exists rate_master_department_idx on public.rate_master (department_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);
