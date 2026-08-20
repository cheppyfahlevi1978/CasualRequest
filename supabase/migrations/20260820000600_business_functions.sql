-- ===========================================================================
-- CASUAL REQUEST — 06. Transactional business functions
-- Every multi-step transition lives here so it either completes fully or not
-- at all, and so approval authority is enforced in the database, not the UI.
-- PRD §12, §13, §17, §18, §27, §30, §53, §63, §66
-- ===========================================================================

-- --- Which approval chain applies to a given amount? (PRD §13) -------------
create or replace function public.resolve_approval_steps(p_hotel uuid, p_cost numeric)
returns public.approval_step[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select r.steps
      from public.approval_rules r
      where r.hotel_id = p_hotel
        and r.is_active
        and coalesce(p_cost, 0) >= r.min_amount
        and (r.max_amount is null or coalesce(p_cost, 0) <= r.max_amount)
      order by r.sort_order, r.min_amount desc
      limit 1
    ),
    array['hod','hr']::public.approval_step[]
  );
$$;

create or replace function app.status_for_step(p_step public.approval_step)
returns public.request_status
language sql
immutable
as $$
  select case p_step
    when 'hod'     then 'hod_approval'
    when 'hr'      then 'hr_review'
    when 'finance' then 'finance_verification'
    when 'gm'      then 'gm_approval'
  end::public.request_status;
$$;

-- --- Notify everyone entitled to act on a step -----------------------------
create or replace function app.notify_step_approvers(p_request uuid, p_step public.approval_step)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  select cr.id, cr.request_no, cr.hotel_id, cr.department_id, cr.qty_required,
         cr.estimated_cost, cr.work_date
    into r
  from public.casual_requests cr where cr.id = p_request;

  if not found then
    return;
  end if;

  insert into public.notifications (user_id, hotel_id, type, title, body, link, dedupe_key)
  select distinct
    ur.user_id,
    r.hotel_id,
    'approval.waiting',
    'Menunggu persetujuan Anda',
    format('%s membutuhkan %s casual untuk %s.', r.request_no, r.qty_required, r.work_date),
    '/approvals?request=' || r.id::text,
    format('approval:%s:%s', r.id, p_step)
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions perm on perm.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id
  where perm.code = 'approval.' || p_step::text
    and (ur.hotel_id is null or ur.hotel_id = r.hotel_id)
    and pr.status = 'active'
    and pr.deleted_at is null
    and pr.notify_inapp
    -- HOD approval stays inside the requesting department.
    and (
      p_step <> 'hod'
      or pr.department_id = r.department_id
      or exists (
        select 1 from public.role_permissions rp2
        join public.permissions p2 on p2.id = rp2.permission_id
        where rp2.role_id = ur.role_id and p2.code = 'request.read_all'
      )
    )
  on conflict do nothing;
end;
$$;

-- --- Submit a request into the approval workflow (PRD §12) ----------------
create or replace function public.submit_request(p_request uuid)
returns public.casual_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.casual_requests;
  v_steps public.approval_step[];
  v_step public.approval_step;
  v_order integer := 0;
begin
  select * into r from public.casual_requests
  where id = p_request and deleted_at is null
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if not (r.requester_id = auth.uid() or public.has_permission('request.update_all', r.hotel_id)) then
    raise exception 'Not authorised to submit this request' using errcode = '42501';
  end if;

  if r.status not in ('draft','returned') then
    raise exception 'Only a draft or returned request can be submitted (current: %)', r.status
      using errcode = 'check_violation';
  end if;

  v_steps := public.resolve_approval_steps(r.hotel_id, r.estimated_cost);

  delete from public.request_approvals where request_id = r.id;

  foreach v_step in array v_steps loop
    v_order := v_order + 1;
    insert into public.request_approvals (request_id, hotel_id, step, step_order, decision)
    values (r.id, r.hotel_id, v_step, v_order, 'pending');
  end loop;

  update public.casual_requests
  set status         = app.status_for_step(v_steps[1]),
      approval_steps = v_steps,
      approval_level = 1,
      submitted_at   = now(),
      reject_reason  = null,
      updated_at     = now()
  where id = r.id
  returning * into r;

  perform app.notify_step_approvers(r.id, v_steps[1]);

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), r.hotel_id, 'SUBMIT_REQUEST', 'requests', r.id::text,
          format('%s submitted for approval', r.request_no));

  return r;
end;
$$;

-- --- Approve / reject / return (PRD §16, §17) ------------------------------
create or replace function public.decide_request(
  p_request  uuid,
  p_decision public.approval_decision,
  p_remark   text default null,
  p_session  jsonb default '{}'::jsonb
)
returns public.casual_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r        public.casual_requests;
  v_step   public.request_approvals;
  v_next   public.request_approvals;
  v_email  text;
  v_roles  text[];
begin
  if p_decision not in ('approved','rejected','returned') then
    raise exception 'Unsupported decision: %', p_decision using errcode = 'check_violation';
  end if;

  select * into r from public.casual_requests
  where id = p_request and deleted_at is null
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  select * into v_step from public.request_approvals
  where request_id = r.id and decision = 'pending'
  order by step_order
  limit 1
  for update;

  if not found then
    raise exception 'This request has no pending approval step' using errcode = 'check_violation';
  end if;

  -- Authority check. request.override lets a Super Admin unblock a stuck chain.
  if not (
       public.has_permission('approval.' || v_step.step::text, r.hotel_id)
       or public.has_permission('approval.override', r.hotel_id)
     ) then
    raise exception 'You are not authorised to act on the % step', v_step.step
      using errcode = '42501';
  end if;

  -- HOD acts only for their own department.
  if v_step.step = 'hod'
     and not public.has_permission('approval.override', r.hotel_id)
     and not public.has_permission('request.read_all', r.hotel_id)
     and public.current_department_id() is distinct from r.department_id then
    raise exception 'HOD approval is limited to your own department' using errcode = '42501';
  end if;

  if r.requester_id = auth.uid() and not public.has_permission('approval.override', r.hotel_id) then
    raise exception 'You cannot approve your own request' using errcode = '42501';
  end if;

  if p_decision <> 'approved' and length(btrim(coalesce(p_remark, ''))) < 3 then
    raise exception 'A remark is required when rejecting or returning a request'
      using errcode = 'check_violation';
  end if;

  select p.email into v_email from public.profiles p where p.id = auth.uid();
  v_roles := public.current_role_codes(r.hotel_id);

  update public.request_approvals
  set decision       = p_decision,
      approver_id    = auth.uid(),
      approver_email = v_email,
      approver_role  = array_to_string(v_roles, ','),
      remark         = nullif(btrim(coalesce(p_remark, '')), ''),
      decided_at     = now(),
      session_info   = coalesce(p_session, '{}'::jsonb)
  where id = v_step.id;

  if p_decision = 'rejected' then
    update public.request_approvals
    set decision = 'skipped', decided_at = now(), approver_id = auth.uid()
    where request_id = r.id and decision = 'pending';

    update public.casual_requests
    set status = 'rejected', reject_reason = p_remark, updated_at = now()
    where id = r.id returning * into r;

  elsif p_decision = 'returned' then
    delete from public.request_approvals where request_id = r.id and decision = 'pending';

    update public.casual_requests
    set status = 'returned', approval_level = 0, updated_at = now()
    where id = r.id returning * into r;

  else
    select * into v_next from public.request_approvals
    where request_id = r.id and decision = 'pending'
    order by step_order limit 1;

    if found then
      update public.casual_requests
      set status = app.status_for_step(v_next.step),
          approval_level = v_next.step_order,
          updated_at = now()
      where id = r.id returning * into r;

      perform app.notify_step_approvers(r.id, v_next.step);
    else
      update public.casual_requests
      set status = 'approved', approved_at = now(),
          approval_level = v_step.step_order, updated_at = now()
      where id = r.id returning * into r;
    end if;
  end if;

  -- Tell the requester what happened.
  insert into public.notifications (user_id, hotel_id, type, title, body, link, dedupe_key)
  select r.requester_id, r.hotel_id,
         'request.' || p_decision::text,
         case p_decision
           when 'approved' then 'Request disetujui'
           when 'rejected' then 'Request ditolak'
           else 'Request dikembalikan untuk revisi'
         end,
         format('%s — %s', r.request_no, coalesce(p_remark, r.status::text)),
         '/requests/' || r.id::text,
         format('decision:%s:%s:%s', r.id, v_step.step, p_decision)
  where exists (select 1 from public.profiles p where p.id = r.requester_id and p.notify_inapp)
  on conflict do nothing;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description, metadata)
  values (auth.uid(), r.hotel_id, upper(p_decision::text), 'approvals', r.id::text,
          format('%s %s at step %s', r.request_no, p_decision, v_step.step),
          jsonb_build_object('step', v_step.step, 'remark', p_remark));

  return r;
end;
$$;

-- --- Cancel / close --------------------------------------------------------
create or replace function public.cancel_request(p_request uuid, p_reason text)
returns public.casual_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.casual_requests;
begin
  select * into r from public.casual_requests where id = p_request and deleted_at is null for update;
  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if not (r.requester_id = auth.uid() or public.has_permission('request.update_all', r.hotel_id)) then
    raise exception 'Not authorised to cancel this request' using errcode = '42501';
  end if;

  if r.status in ('completed','closed','cancelled') then
    raise exception 'A % request can no longer be cancelled', r.status using errcode = 'check_violation';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A cancellation reason is required' using errcode = 'check_violation';
  end if;

  update public.request_approvals
  set decision = 'skipped', decided_at = now()
  where request_id = r.id and decision = 'pending';

  update public.assignments set status = 'cancelled', updated_at = now()
  where request_id = r.id and status in ('assigned','confirmed');

  update public.casual_requests
  set status = 'cancelled', cancel_reason = p_reason, updated_at = now()
  where id = r.id returning * into r;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), r.hotel_id, 'CANCEL_REQUEST', 'requests', r.id::text,
          format('%s cancelled: %s', r.request_no, p_reason));

  return r;
end;
$$;

create or replace function public.close_request(p_request uuid)
returns public.casual_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.casual_requests;
  v_open integer;
begin
  select * into r from public.casual_requests where id = p_request and deleted_at is null for update;
  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if not public.has_permission('request.close', r.hotel_id) then
    raise exception 'Not authorised to close this request' using errcode = '42501';
  end if;

  select count(*) into v_open
  from public.assignments a
  where a.request_id = r.id and a.status in ('assigned','confirmed','present');

  if v_open > 0 then
    raise exception 'There are still % open assignments on this request', v_open
      using errcode = 'check_violation';
  end if;

  update public.casual_requests
  set status = 'closed', closed_at = now(), updated_at = now()
  where id = r.id returning * into r;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), r.hotel_id, 'CLOSE_REQUEST', 'requests', r.id::text,
          format('%s closed', r.request_no));

  return r;
end;
$$;

-- --- Assignment (PRD §18, §19) --------------------------------------------
create or replace function public.assign_casuals(p_request uuid, p_casual_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.casual_requests;
  v_casual uuid;
  v_rate numeric(14,2);
  v_assigned integer;
  v_inserted integer := 0;
  v_blacklisted boolean;
begin
  select * into r from public.casual_requests where id = p_request and deleted_at is null for update;
  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if not public.has_permission('assignment.manage', r.hotel_id) then
    raise exception 'Not authorised to assign casual workers' using errcode = '42501';
  end if;

  if r.status not in ('approved','assigned','in_progress') then
    raise exception 'Only an approved request can receive assignments (current: %)', r.status
      using errcode = 'check_violation';
  end if;

  select count(*) into v_assigned
  from public.assignments a where a.request_id = r.id and a.status <> 'cancelled';

  foreach v_casual in array coalesce(p_casual_ids, '{}'::uuid[]) loop
    if v_assigned + v_inserted >= r.qty_required then
      raise exception 'Assignment exceeds the requested quantity of %', r.qty_required
        using errcode = 'check_violation';
    end if;

    select exists (
      select 1 from public.blacklist b
      where b.casual_id = v_casual and b.released_at is null
    ) into v_blacklisted;

    if v_blacklisted then
      raise exception 'Casual % is blacklisted and cannot be assigned', v_casual
        using errcode = 'check_violation';
    end if;

    v_rate := coalesce(nullif(r.rate, 0), (
      select rm.rate from public.rate_master rm
      where rm.hotel_id = r.hotel_id
        and rm.is_active
        and (rm.department_id is null or rm.department_id = r.department_id)
        and rm.effective_from <= r.work_date
        and (rm.effective_to is null or rm.effective_to >= r.work_date)
      order by rm.department_id nulls last, rm.effective_from desc
      limit 1
    ), 0);

    insert into public.assignments (
      request_id, casual_id, hotel_id, department_id, work_date, shift_id, rate, status, created_by
    ) values (
      r.id, v_casual, r.hotel_id, r.department_id, r.work_date, r.shift_id, v_rate, 'assigned', auth.uid()
    )
    on conflict (request_id, casual_id) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  if v_assigned + v_inserted >= r.qty_required and r.status = 'approved' then
    update public.casual_requests set status = 'assigned', updated_at = now() where id = r.id;
  end if;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description, metadata)
  values (auth.uid(), r.hotel_id, 'ASSIGN_CASUAL', 'assignments', r.id::text,
          format('%s casual assigned to %s', v_inserted, r.request_no),
          jsonb_build_object('casual_ids', to_jsonb(p_casual_ids)));

  return v_inserted;
end;
$$;

create or replace function public.unassign_casual(p_assignment uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.assignments;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if not public.has_permission('assignment.manage', a.hotel_id) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if a.status in ('present','completed') then
    raise exception 'A casual who already checked in cannot be unassigned'
      using errcode = 'check_violation';
  end if;

  update public.assignments set status = 'cancelled', updated_at = now() where id = a.id;

  update public.casual_requests
  set status = case when status = 'assigned' then 'approved'::public.request_status else status end,
      updated_at = now()
  where id = a.request_id;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), a.hotel_id, 'UNASSIGN_CASUAL', 'assignments', a.id::text, 'Assignment cancelled');
end;
$$;

-- --- Attendance (PRD §24, §26, §27) ---------------------------------------
create or replace function app.distance_meters(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ))::numeric;
$$;

create or replace function public.casual_check_in(
  p_assignment uuid,
  p_latitude   numeric default null,
  p_longitude  numeric default null,
  p_method     text    default 'manual'
)
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a  public.assignments;
  h  public.hotels;
  t  public.attendance;
  v_scheduled timestamptz;
  v_check public.location_check := 'not_required';
  v_distance numeric;
  v_self boolean;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  v_self := (a.casual_id = public.current_casual_id());
  if not (v_self or public.has_permission('attendance.manage', a.hotel_id)) then
    raise exception 'Not authorised to record attendance' using errcode = '42501';
  end if;

  if a.status = 'cancelled' then
    raise exception 'This assignment was cancelled' using errcode = 'check_violation';
  end if;

  select * into h from public.hotels where id = a.hotel_id;

  select (a.work_date + coalesce(s.start_time, cr.start_time)) at time zone h.timezone
    into v_scheduled
  from public.casual_requests cr
  left join public.shifts s on s.id = a.shift_id
  where cr.id = a.request_id;

  if p_latitude is not null and p_longitude is not null
     and h.latitude is not null and h.longitude is not null then
    v_distance := app.distance_meters(h.latitude, h.longitude, p_latitude, p_longitude);
    v_check := case when v_distance <= h.geofence_radius_m then 'valid' else 'invalid' end;
  elsif p_latitude is null and h.latitude is not null then
    v_check := 'unavailable';
  end if;

  insert into public.attendance (
    assignment_id, request_id, casual_id, hotel_id, department_id, attendance_date,
    shift_id, scheduled_start, check_in, latitude, longitude, location_validation,
    check_in_method, break_minutes, created_by
  ) values (
    a.id, a.request_id, a.casual_id, a.hotel_id, a.department_id, a.work_date,
    a.shift_id, v_scheduled, now(), p_latitude, p_longitude, v_check,
    coalesce(p_method, 'manual'),
    coalesce((select s.break_minutes from public.shifts s where s.id = a.shift_id), 60),
    auth.uid()
  )
  on conflict (assignment_id, attendance_date) do update
    set check_in = coalesce(attendance.check_in, now()),
        latitude = coalesce(excluded.latitude, attendance.latitude),
        longitude = coalesce(excluded.longitude, attendance.longitude),
        location_validation = excluded.location_validation,
        check_in_method = excluded.check_in_method,
        updated_at = now()
  returning * into t;

  update public.casual_requests
  set status = case when status = 'assigned' then 'in_progress'::public.request_status else status end,
      updated_at = now()
  where id = a.request_id;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), a.hotel_id, 'CHECK_IN', 'attendance', t.id::text,
          format('Check-in recorded (%s)', v_check));

  return t;
end;
$$;

create or replace function public.casual_check_out(
  p_assignment    uuid,
  p_break_minutes integer default null,
  p_remark        text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.assignments;
  t public.attendance;
  v_self boolean;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  v_self := (a.casual_id = public.current_casual_id());
  if not (v_self or public.has_permission('attendance.manage', a.hotel_id)) then
    raise exception 'Not authorised to record attendance' using errcode = '42501';
  end if;

  select * into t from public.attendance
  where assignment_id = a.id and attendance_date = a.work_date
  for update;

  if not found or t.check_in is null then
    raise exception 'Check-in must be recorded before check-out' using errcode = 'check_violation';
  end if;

  if t.check_out is not null then
    raise exception 'Check-out was already recorded' using errcode = 'check_violation';
  end if;

  update public.attendance
  set check_out     = now(),
      break_minutes = coalesce(p_break_minutes, break_minutes),
      remark        = coalesce(nullif(btrim(coalesce(p_remark, '')), ''), remark),
      updated_at    = now()
  where id = t.id
  returning * into t;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), a.hotel_id, 'CHECK_OUT', 'attendance', t.id::text,
          format('Check-out recorded, %s working minutes', t.working_minutes));

  return t;
end;
$$;

create or replace function public.mark_attendance(
  p_assignment uuid,
  p_status     public.attendance_status,
  p_remark     text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.assignments;
  t public.attendance;
begin
  select * into a from public.assignments where id = p_assignment for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if not public.has_permission('attendance.manage', a.hotel_id) then
    raise exception 'Not authorised to record attendance' using errcode = '42501';
  end if;

  insert into public.attendance (
    assignment_id, request_id, casual_id, hotel_id, department_id,
    attendance_date, shift_id, status, remark, created_by
  ) values (
    a.id, a.request_id, a.casual_id, a.hotel_id, a.department_id,
    a.work_date, a.shift_id, p_status, p_remark, auth.uid()
  )
  on conflict (assignment_id, attendance_date) do update
    set status = excluded.status,
        remark = coalesce(excluded.remark, attendance.remark),
        updated_at = now()
  returning * into t;

  return t;
end;
$$;

-- --- Payment generation (PRD §30) -----------------------------------------
create or replace function public.generate_payments(p_request uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.casual_requests;
  v_count integer := 0;
  rec record;
  v_rate_type public.rate_type;
  v_ot_rate numeric(14,2);
  v_allowance numeric(14,2);
  v_basic numeric(14,2);
  v_ot_amount numeric(14,2);
  v_hours numeric(6,2);
  v_ot_hours numeric(6,2);
begin
  select * into r from public.casual_requests where id = p_request and deleted_at is null;
  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if not public.has_permission('payment.generate', r.hotel_id) then
    raise exception 'Not authorised to generate payments' using errcode = '42501';
  end if;

  for rec in
    select a.id as assignment_id, a.casual_id, a.rate, a.work_date, a.department_id,
           t.working_minutes, t.overtime_minutes, t.status as att_status
    from public.assignments a
    left join public.attendance t
      on t.assignment_id = a.id and t.attendance_date = a.work_date
    where a.request_id = r.id
      and a.status <> 'cancelled'
      and coalesce(t.status, 'scheduled') in ('present','late')
      and not exists (select 1 from public.payments p where p.assignment_id = a.id)
  loop
    select rm.rate_type, rm.overtime_rate, (rm.meal_allowance + rm.transport_allowance)
      into v_rate_type, v_ot_rate, v_allowance
    from public.rate_master rm
    where rm.hotel_id = r.hotel_id
      and rm.is_active
      and (rm.department_id is null or rm.department_id = rec.department_id)
      and rm.effective_from <= rec.work_date
      and (rm.effective_to is null or rm.effective_to >= rec.work_date)
    order by rm.department_id nulls last, rm.effective_from desc
    limit 1;

    v_rate_type := coalesce(v_rate_type, 'daily');
    v_ot_rate   := coalesce(v_ot_rate, 0);
    v_allowance := coalesce(v_allowance, 0);

    v_hours    := round(coalesce(rec.working_minutes, 0)::numeric / 60.0, 2);
    v_ot_hours := round(coalesce(rec.overtime_minutes, 0)::numeric / 60.0, 2);

    v_basic := case
      when v_rate_type = 'hourly' then round(rec.rate * greatest(v_hours - v_ot_hours, 0), 2)
      else rec.rate
    end;
    v_ot_amount := round(v_ot_rate * v_ot_hours, 2);

    insert into public.payments (
      assignment_id, request_id, casual_id, hotel_id, department_id, work_date,
      rate_type, rate, worked_hours, overtime_hours,
      basic_amount, allowance, overtime_amount, deduction, status, created_by
    ) values (
      rec.assignment_id, r.id, rec.casual_id, r.hotel_id, rec.department_id, rec.work_date,
      v_rate_type, rec.rate, v_hours, v_ot_hours,
      v_basic, v_allowance, v_ot_amount, 0, 'pending', auth.uid()
    )
    on conflict (assignment_id) do nothing;

    v_count := v_count + 1;
  end loop;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), r.hotel_id, 'GENERATE_PAYMENT', 'payments', r.id::text,
          format('%s payment lines generated for %s', v_count, r.request_no));

  return v_count;
end;
$$;

create or replace function public.set_payment_status(
  p_payment uuid,
  p_status  public.payment_status,
  p_reference text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;

  if p_status in ('verified','approved') and not public.has_permission('payment.verify', p.hotel_id) then
    raise exception 'Not authorised to verify payments' using errcode = '42501';
  end if;
  if p_status = 'paid' and not public.has_permission('payment.pay', p.hotel_id) then
    raise exception 'Not authorised to settle payments' using errcode = '42501';
  end if;
  if p.status = 'paid' then
    raise exception 'A settled payment can no longer be changed' using errcode = 'check_violation';
  end if;

  update public.payments
  set status      = p_status,
      verified_by = case when p_status = 'verified' then auth.uid() else verified_by end,
      verified_at = case when p_status = 'verified' then now() else verified_at end,
      approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when p_status = 'approved' then now() else approved_at end,
      paid_by     = case when p_status = 'paid' then auth.uid() else paid_by end,
      paid_at     = case when p_status = 'paid' then now() else paid_at end,
      payment_reference = coalesce(p_reference, payment_reference),
      updated_at  = now()
  where id = p.id
  returning * into p;

  insert into public.activity_logs (user_id, hotel_id, action, module, record_id, description)
  values (auth.uid(), p.hotel_id, 'PAYMENT_' || upper(p_status::text), 'payments', p.id::text,
          format('Payment marked %s', p_status));

  return p;
end;
$$;

grant execute on function
  public.resolve_approval_steps(uuid, numeric),
  public.submit_request(uuid),
  public.decide_request(uuid, public.approval_decision, text, jsonb),
  public.cancel_request(uuid, text),
  public.close_request(uuid),
  public.assign_casuals(uuid, uuid[]),
  public.unassign_casual(uuid),
  public.casual_check_in(uuid, numeric, numeric, text),
  public.casual_check_out(uuid, integer, text),
  public.mark_attendance(uuid, public.attendance_status, text),
  public.generate_payments(uuid),
  public.set_payment_status(uuid, public.payment_status, text)
to authenticated;
