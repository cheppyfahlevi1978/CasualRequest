-- ===========================================================================
-- CASUAL REQUEST — 07. Row Level Security
-- Every exposed table gets RLS. Tables with no policy for an action are
-- closed by default; those transitions run through the SECURITY DEFINER
-- functions in migration 06, which do their own authority checks.
-- PRD §39, §63, §65
-- ===========================================================================

do $$
declare
  t text;
  tables text[] := array[
    'app_config','hotels','departments','profiles','roles','permissions',
    'role_permissions','user_roles','user_hotels','shifts','rate_master',
    'approval_rules','settings','budgets','casual_workers','blacklist',
    'casual_requests','request_number_sequences','request_approvals',
    'assignments','attendance','evaluations','payments','documents',
    'notifications','activity_logs','audit_logs','system_logs'
  ];
begin
  foreach t in array tables loop
    -- NOTE: deliberately NOT 'force row level security'. The table owner must
    -- keep its bypass so the SECURITY DEFINER business functions in migration 06
    -- can run. Application traffic arrives as the 'authenticated' role, which is
    -- fully governed by the policies below.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Anonymous callers get nothing anywhere.
revoke all on all tables in schema public from anon;

-- --- Guard: nobody may quietly escalate their own account ------------------
create or replace function app.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;                       -- service-role / migration context
  end if;

  if new.id = auth.uid()
     and not public.has_permission('user.manage', coalesce(new.primary_hotel_id, old.primary_hotel_id)) then
    if new.status           is distinct from old.status
       or new.primary_hotel_id is distinct from old.primary_hotel_id
       or new.department_id is distinct from old.department_id
       or new.employee_id   is distinct from old.employee_id
       or new.email         is distinct from old.email
       or new.deleted_at    is distinct from old.deleted_at then
      raise exception 'You may only change your own display preferences' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update before update on public.profiles
for each row execute function app.guard_profile_update();

-- Only a Super Admin can hand out the Super Admin role.
create or replace function app.guard_role_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    return new;
  end if;
  select r.code into v_code from public.roles r where r.id = new.role_id;
  if v_code = 'super_admin' and not public.is_super_admin() then
    raise exception 'Only a Super Admin may grant the Super Admin role' using errcode = '42501';
  end if;
  if new.user_id = auth.uid() and not public.is_super_admin() then
    raise exception 'You may not grant roles to yourself' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_role_grant on public.user_roles;
create trigger trg_guard_role_grant before insert or update on public.user_roles
for each row execute function app.guard_role_grant();

-- ===========================================================================
-- Policies
-- ===========================================================================

-- --- app_config ------------------------------------------------------------
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select to authenticated
  using (public.is_active_user() and is_secret = false);

drop policy if exists app_config_write on public.app_config;
create policy app_config_write on public.app_config
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- --- hotels ----------------------------------------------------------------
drop policy if exists hotels_read on public.hotels;
create policy hotels_read on public.hotels
  for select to authenticated
  using (id in (select public.accessible_hotel_ids()));

drop policy if exists hotels_insert on public.hotels;
create policy hotels_insert on public.hotels
  for insert to authenticated with check (public.is_super_admin());

drop policy if exists hotels_update on public.hotels;
create policy hotels_update on public.hotels
  for update to authenticated
  using (public.has_permission('hotel.manage', id))
  with check (public.has_permission('hotel.manage', id));

-- --- departments -----------------------------------------------------------
drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments
  for select to authenticated using (public.has_hotel_access(hotel_id));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.has_permission('department.manage', hotel_id))
  with check (public.has_permission('department.manage', hotel_id));

-- --- profiles --------------------------------------------------------------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.shares_hotel_with(public.profiles.id)
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_permission('user.manage', primary_hotel_id))
  with check (id = auth.uid() or public.has_permission('user.manage', primary_hotel_id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.has_permission('user.manage', primary_hotel_id));

-- --- RBAC catalogue (readable so the UI can render role pickers) -----------
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
  for select to authenticated using (public.is_active_user());

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions
  for select to authenticated using (public.is_active_user());

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select to authenticated using (public.is_active_user());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- --- user_roles / user_hotels ---------------------------------------------
drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or public.has_permission('user.read', hotel_id)
  );

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.has_permission('user.manage', hotel_id))
  with check (public.has_permission('user.manage', hotel_id));

drop policy if exists user_hotels_read on public.user_hotels;
create policy user_hotels_read on public.user_hotels
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or public.has_permission('user.read', hotel_id)
  );

drop policy if exists user_hotels_write on public.user_hotels;
create policy user_hotels_write on public.user_hotels
  for all to authenticated
  using (public.has_permission('user.manage', hotel_id))
  with check (public.has_permission('user.manage', hotel_id));

-- --- Master data -----------------------------------------------------------
drop policy if exists shifts_read on public.shifts;
create policy shifts_read on public.shifts
  for select to authenticated using (public.has_hotel_access(hotel_id));

drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts
  for all to authenticated
  using (public.has_permission('settings.manage', hotel_id))
  with check (public.has_permission('settings.manage', hotel_id));

drop policy if exists rate_master_read on public.rate_master;
create policy rate_master_read on public.rate_master
  for select to authenticated using (public.has_hotel_access(hotel_id));

drop policy if exists rate_master_write on public.rate_master;
create policy rate_master_write on public.rate_master
  for all to authenticated
  using (public.has_permission('settings.manage', hotel_id))
  with check (public.has_permission('settings.manage', hotel_id));

drop policy if exists approval_rules_read on public.approval_rules;
create policy approval_rules_read on public.approval_rules
  for select to authenticated using (public.has_hotel_access(hotel_id));

drop policy if exists approval_rules_write on public.approval_rules;
create policy approval_rules_write on public.approval_rules
  for all to authenticated
  using (public.has_permission('settings.manage', hotel_id))
  with check (public.has_permission('settings.manage', hotel_id));

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select to authenticated
  using (hotel_id is null or public.has_hotel_access(hotel_id));

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings
  for all to authenticated
  using (
    case when hotel_id is null then public.is_super_admin()
         else public.has_permission('settings.manage', hotel_id) end
  )
  with check (
    case when hotel_id is null then public.is_super_admin()
         else public.has_permission('settings.manage', hotel_id) end
  );

drop policy if exists budgets_read on public.budgets;
create policy budgets_read on public.budgets
  for select to authenticated using (public.has_permission('budget.read', hotel_id));

drop policy if exists budgets_write on public.budgets;
create policy budgets_write on public.budgets
  for all to authenticated
  using (public.has_permission('budget.manage', hotel_id))
  with check (public.has_permission('budget.manage', hotel_id));

-- --- Casual workers --------------------------------------------------------
drop policy if exists casual_workers_read on public.casual_workers;
create policy casual_workers_read on public.casual_workers
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.has_permission('casual.read', hotel_id)
  );

drop policy if exists casual_workers_insert on public.casual_workers;
create policy casual_workers_insert on public.casual_workers
  for insert to authenticated
  with check (public.has_permission('casual.manage', hotel_id));

drop policy if exists casual_workers_update on public.casual_workers;
create policy casual_workers_update on public.casual_workers
  for update to authenticated
  using (public.has_permission('casual.manage', hotel_id))
  with check (public.has_permission('casual.manage', hotel_id));

-- Blacklist reasons stay with HR and Super Admin only (PRD §32).
drop policy if exists blacklist_read on public.blacklist;
create policy blacklist_read on public.blacklist
  for select to authenticated using (public.has_permission('casual.blacklist_read', hotel_id));

drop policy if exists blacklist_write on public.blacklist;
create policy blacklist_write on public.blacklist
  for all to authenticated
  using (public.has_permission('casual.blacklist_manage', hotel_id))
  with check (public.has_permission('casual.blacklist_manage', hotel_id));

-- --- Casual requests -------------------------------------------------------
drop policy if exists casual_requests_read on public.casual_requests;
create policy casual_requests_read on public.casual_requests
  for select to authenticated
  using (
    requester_id = auth.uid()
    or public.can_read_department_scope(hotel_id, department_id)
  );

drop policy if exists casual_requests_insert on public.casual_requests;
create policy casual_requests_insert on public.casual_requests
  for insert to authenticated
  with check (
    public.has_permission('request.create', hotel_id)
    and requester_id = auth.uid()
    and status = 'draft'
    and (
      public.has_permission('request.read_all', hotel_id)
      or department_id = public.current_department_id()
    )
  );

drop policy if exists casual_requests_update on public.casual_requests;
create policy casual_requests_update on public.casual_requests
  for update to authenticated
  using (
    (requester_id = auth.uid() and status in ('draft','returned'))
    or public.has_permission('request.update_all', hotel_id)
  )
  with check (
    (requester_id = auth.uid() and status in ('draft','returned'))
    or public.has_permission('request.update_all', hotel_id)
  );

-- --- Approvals (readable; transitions only via decide_request) -------------
drop policy if exists request_approvals_read on public.request_approvals;
create policy request_approvals_read on public.request_approvals
  for select to authenticated
  using (
    exists (
      select 1 from public.casual_requests cr
      where cr.id = request_approvals.request_id
        and (cr.requester_id = auth.uid()
             or public.can_read_department_scope(cr.hotel_id, cr.department_id))
    )
    or public.has_permission('approval.' || step::text, hotel_id)
  );

-- --- Assignments -----------------------------------------------------------
drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select to authenticated
  using (
    casual_id = public.current_casual_id()
    or public.can_read_department_scope(hotel_id, department_id)
    or exists (
      select 1 from public.casual_requests cr
      where cr.id = assignments.request_id and cr.requester_id = auth.uid()
    )
  );

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments
  for all to authenticated
  using (public.has_permission('assignment.manage', hotel_id))
  with check (public.has_permission('assignment.manage', hotel_id));

-- --- Attendance ------------------------------------------------------------
drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance
  for select to authenticated
  using (
    casual_id = public.current_casual_id()
    or public.has_permission('attendance.read', hotel_id)
    or public.can_read_department_scope(hotel_id, department_id)
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all to authenticated
  using (public.has_permission('attendance.manage', hotel_id))
  with check (public.has_permission('attendance.manage', hotel_id));

-- --- Evaluations -----------------------------------------------------------
drop policy if exists evaluations_read on public.evaluations;
create policy evaluations_read on public.evaluations
  for select to authenticated
  using (
    public.has_permission('evaluation.read', hotel_id)
    or public.can_read_department_scope(hotel_id, department_id)
  );

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated
  with check (
    public.has_permission('evaluation.manage', hotel_id)
    and evaluator_id = auth.uid()
  );

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (
    public.has_permission('evaluation.manage', hotel_id)
    and (evaluator_id = auth.uid() or public.has_permission('request.read_all', hotel_id))
  )
  with check (public.has_permission('evaluation.manage', hotel_id));

-- --- Payments --------------------------------------------------------------
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select to authenticated
  using (
    casual_id = public.current_casual_id()
    or public.has_permission('payment.read', hotel_id)
  );

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (public.has_permission('payment.verify', hotel_id) and status <> 'paid')
  with check (public.has_permission('payment.verify', hotel_id));

-- --- Documents -------------------------------------------------------------
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated
  using (
    is_deleted = false
    and (
      profile_id = auth.uid()
      or casual_id = public.current_casual_id()
      or public.has_permission('document.read', hotel_id)
    )
  );

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    public.has_permission('document.manage', hotel_id)
    or profile_id = auth.uid()
    or casual_id = public.current_casual_id()
  );

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update to authenticated
  using (public.has_permission('document.manage', hotel_id))
  with check (public.has_permission('document.manage', hotel_id));

-- --- Notifications (strictly personal) -------------------------------------
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --- Logs ------------------------------------------------------------------
-- Append-oriented: a user may record their own activity but never edit it.
drop policy if exists activity_logs_read on public.activity_logs;
create policy activity_logs_read on public.activity_logs
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('audit.read', hotel_id));

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid() and (hotel_id is null or public.has_hotel_access(hotel_id)));

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select to authenticated using (public.has_permission('audit.read', hotel_id));

drop policy if exists system_logs_read on public.system_logs;
create policy system_logs_read on public.system_logs
  for select to authenticated using (public.is_super_admin());

-- request_number_sequences intentionally has no policy: only
-- public.next_request_no() (SECURITY DEFINER) may touch it.
