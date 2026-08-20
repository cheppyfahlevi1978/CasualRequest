-- ===========================================================================
-- CASUAL REQUEST — 10. Reference data (roles, permissions) and hotel bootstrap
-- Idempotent: safe to re-run on every environment. PRD §69 steps 10-15
-- ===========================================================================

insert into public.permissions (code, module, description) values
  ('request.create',           'requests',    'Create casual requests'),
  ('request.read_all',         'requests',    'Read every request in the hotel'),
  ('request.update_all',       'requests',    'Edit or cancel any request'),
  ('request.close',            'requests',    'Close a completed request'),
  ('approval.hod',             'approvals',   'Approve at the Department Head step'),
  ('approval.hr',              'approvals',   'Approve at the HR Review step'),
  ('approval.finance',         'approvals',   'Approve at the Finance Verification step'),
  ('approval.gm',              'approvals',   'Approve at the General Manager step'),
  ('approval.override',        'approvals',   'Override a stuck approval chain'),
  ('assignment.manage',        'assignments', 'Assign and unassign casual workers'),
  ('casual.read',              'casuals',     'Read the casual worker database'),
  ('casual.manage',            'casuals',     'Create and edit casual workers'),
  ('casual.blacklist_read',    'casuals',     'See blacklist entries and their reasons'),
  ('casual.blacklist_manage',  'casuals',     'Add or release blacklist entries'),
  ('attendance.read',          'attendance',  'Read attendance records'),
  ('attendance.manage',        'attendance',  'Record check-in, check-out and status'),
  ('evaluation.read',          'evaluations', 'Read casual evaluations'),
  ('evaluation.manage',        'evaluations', 'Submit and edit casual evaluations'),
  ('payment.read',             'payments',    'Read casual payment records'),
  ('payment.generate',         'payments',    'Generate payment lines from attendance'),
  ('payment.verify',           'payments',    'Verify and approve payments'),
  ('payment.pay',              'payments',    'Mark payments as settled'),
  ('budget.read',              'budgets',     'Read casual budgets'),
  ('budget.manage',            'budgets',     'Set and adjust casual budgets'),
  ('document.read',            'documents',   'Read stored documents'),
  ('document.manage',          'documents',   'Upload, replace and archive documents'),
  ('report.read',              'reports',     'Open reports'),
  ('report.export',            'reports',     'Export reports to CSV/PDF'),
  ('analytics.read',           'analytics',   'Open the analytics workspace'),
  ('user.read',                'users',       'Read the user directory'),
  ('user.manage',              'users',       'Provision users and assign roles'),
  ('hotel.manage',             'settings',    'Create and edit hotel units'),
  ('department.manage',        'settings',    'Manage departments'),
  ('settings.manage',          'settings',    'Manage shifts, rates, thresholds and settings'),
  ('audit.read',               'audit',       'Read audit and activity logs')
on conflict (code) do update set module = excluded.module, description = excluded.description;

insert into public.roles (code, name, description, rank, is_system) values
  ('super_admin',     'Super Admin',      'Full access across every hotel unit',                0,  true),
  ('hr_admin',        'HR Admin',         'Primary operational administrator',                  10, true),
  ('general_manager', 'General Manager',  'Approves and monitors hotel-wide manpower',          20, true),
  ('finance',         'Finance',          'Verifies cost, budget and casual payment',           30, true),
  ('hod',             'Department Head',  'Raises and approves requests for one department',    40, true),
  ('supervisor',      'Supervisor',       'Drafts requests and records attendance',             50, true),
  ('viewer',          'Viewer / Management', 'Read-only dashboards and reports',                60, true),
  ('casual_worker',   'Casual Worker',    'Self-service portal for assigned casual workers',    90, true)
on conflict (code) do update
  set name = excluded.name, description = excluded.description, rank = excluded.rank;

-- --- Role to permission mapping -------------------------------------------
do $$
declare
  v_map jsonb := jsonb_build_object(
    'hr_admin', jsonb_build_array(
      'request.create','request.read_all','request.update_all','request.close',
      'approval.hr','assignment.manage',
      'casual.read','casual.manage','casual.blacklist_read','casual.blacklist_manage',
      'attendance.read','attendance.manage','evaluation.read','evaluation.manage',
      'payment.read','payment.generate','budget.read',
      'document.read','document.manage','report.read','report.export','analytics.read',
      'user.read','user.manage','department.manage','settings.manage','audit.read'),
    'general_manager', jsonb_build_array(
      'request.read_all','approval.gm','casual.read','attendance.read','evaluation.read',
      'payment.read','budget.read','document.read','report.read','report.export',
      'analytics.read','user.read','audit.read'),
    'finance', jsonb_build_array(
      'request.read_all','approval.finance','casual.read','attendance.read',
      'payment.read','payment.generate','payment.verify','payment.pay',
      'budget.read','budget.manage','report.read','report.export','analytics.read'),
    'hod', jsonb_build_array(
      'request.create','approval.hod','casual.read','attendance.read','attendance.manage',
      'evaluation.read','evaluation.manage','document.read','report.read'),
    'supervisor', jsonb_build_array(
      'request.create','casual.read','attendance.read','attendance.manage',
      'evaluation.read','evaluation.manage'),
    'viewer', jsonb_build_array(
      'request.read_all','casual.read','attendance.read','budget.read',
      'report.read','analytics.read'),
    'casual_worker', jsonb_build_array()
  );
  v_role text;
begin
  -- Super Admin always holds every permission, including newly added ones.
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id from public.roles r cross join public.permissions p
  where r.code = 'super_admin'
  on conflict do nothing;

  for v_role in select jsonb_object_keys(v_map) loop
    delete from public.role_permissions rp
    using public.roles r
    where rp.role_id = r.id and r.code = v_role;

    insert into public.role_permissions (role_id, permission_id)
    select r.id, p.id
    from public.roles r
    join public.permissions p
      on p.code in (select jsonb_array_elements_text(v_map -> v_role))
    where r.code = v_role
    on conflict do nothing;
  end loop;
end $$;

-- --- Hotel bootstrap: departments, shifts, rates, thresholds, settings -----
create or replace function public.bootstrap_hotel_defaults(p_hotel uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
begin
  -- auth.uid() is null in migration/seed/service-role context; there is no
  -- end user to authorise, so the defaults are allowed through.
  if auth.uid() is not null
     and not (public.is_super_admin() or public.has_permission('hotel.manage', p_hotel)) then
    raise exception 'Not authorised to configure this hotel' using errcode = '42501';
  end if;

  insert into public.departments (hotel_id, code, name, sort_order)
  values
    (p_hotel, 'FO',   'Front Office',        10),
    (p_hotel, 'HK',   'Housekeeping',        20),
    (p_hotel, 'FB',   'Food & Beverage',     30),
    (p_hotel, 'BQT',  'Banquet',             40),
    (p_hotel, 'KIT',  'Kitchen',             50),
    (p_hotel, 'ENG',  'Engineering',         60),
    (p_hotel, 'SM',   'Sales & Marketing',   70),
    (p_hotel, 'SEC',  'Security',            80),
    (p_hotel, 'FIN',  'Finance & Accounting',90),
    (p_hotel, 'HRD',  'Human Resources',    100),
    (p_hotel, 'IT',   'Information Technology', 110)
  on conflict do nothing;

  insert into public.shifts (hotel_id, code, name, start_time, end_time, break_minutes, crosses_midnight)
  values
    (p_hotel, 'M', 'Morning',   '07:00', '15:00', 60, false),
    (p_hotel, 'A', 'Afternoon', '15:00', '23:00', 60, false),
    (p_hotel, 'N', 'Night',     '23:00', '07:00', 60, true),
    (p_hotel, 'S', 'Split / Event', '10:00', '22:00', 90, false)
  on conflict (hotel_id, code) do nothing;

  insert into public.rate_master (hotel_id, position, rate_type, rate, overtime_rate, meal_allowance)
  select p_hotel, 'GENERAL', 'daily', 150000, 20000, 25000
  where not exists (
    select 1 from public.rate_master rm where rm.hotel_id = p_hotel and rm.position = 'GENERAL'
  );

  -- PRD §13 default thresholds, in IDR.
  insert into public.approval_rules (hotel_id, name, min_amount, max_amount, steps, sort_order)
  select * from (values
    (p_hotel, 'Small request (<= Rp1.000.000)',        0::numeric,       1000000::numeric,
      array['hod','hr']::public.approval_step[], 10),
    (p_hotel, 'Medium request (Rp1.000.001 - Rp3.000.000)', 1000000.01::numeric, 3000000::numeric,
      array['hod','hr','finance']::public.approval_step[], 20),
    (p_hotel, 'Large request (> Rp3.000.000)',         3000000.01::numeric, null::numeric,
      array['hod','hr','finance','gm']::public.approval_step[], 30)
  ) as v(hotel_id, name, min_amount, max_amount, steps, sort_order)
  where not exists (
    select 1 from public.approval_rules ar where ar.hotel_id = p_hotel
  );

  insert into public.settings (hotel_id, category, key, value) values
    (p_hotel, 'attendance', 'rules', jsonb_build_object(
       'standard_minutes', 480,
       'late_tolerance_minutes', 15,
       'require_geolocation', false,
       'qr_expiry_minutes', 10)),
    (p_hotel, 'casual', 'rules', jsonb_build_object(
       'overtime_enabled', true,
       'rating_threshold_recommended', 4.0,
       'payment_basis', 'daily')),
    (p_hotel, 'notification', 'rules', jsonb_build_object(
       'email_enabled', false,
       'inapp_enabled', true))
  on conflict do nothing;
end;
$$;

grant execute on function public.bootstrap_hotel_defaults(uuid) to authenticated;

-- Newly created hotels get their defaults automatically.
create or replace function app.after_hotel_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.bootstrap_hotel_defaults(new.id);
  return null;
exception
  when insufficient_privilege then
    return null;
end;
$$;

drop trigger if exists trg_after_hotel_insert on public.hotels;
create trigger trg_after_hotel_insert after insert on public.hotels
for each row execute function app.after_hotel_insert();

-- --- Global defaults -------------------------------------------------------
insert into public.app_config (key, value, description) values
  ('app.name',      to_jsonb('Casual Request'::text), 'Application display name'),
  ('app.version',   to_jsonb('1.0.0'::text),          'Schema/application version'),
  ('app.default_timezone', to_jsonb('Asia/Jakarta'::text), 'Fallback timezone'),
  ('app.default_currency', to_jsonb('IDR'::text),     'Fallback currency'),
  ('app.default_locale',   to_jsonb('id'::text),      'Fallback UI language')
on conflict (key) do nothing;
