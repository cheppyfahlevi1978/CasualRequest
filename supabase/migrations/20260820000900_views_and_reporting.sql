-- ===========================================================================
-- CASUAL REQUEST — 09. Reporting views and dashboard aggregation
-- Views use security_invoker so the caller's RLS still applies.
-- The dashboard RPC is SECURITY INVOKER on purpose: one round trip instead of
-- a dozen, but no privilege escalation. PRD §7, §8, §37, §38, §52
-- ===========================================================================

-- --- Request list with the joins every screen needs ------------------------
create or replace view public.v_request_list
with (security_invoker = true) as
select
  cr.id,
  cr.request_no,
  cr.hotel_id,
  h.code                as hotel_code,
  h.name                as hotel_name,
  cr.department_id,
  d.name                as department_name,
  cr.requester_id,
  p.full_name           as requester_name,
  p.email               as requester_email,
  cr.request_date,
  cr.work_date,
  cr.start_time,
  cr.end_time,
  cr.shift_id,
  cr.position_required,
  cr.request_type,
  cr.event_name,
  cr.qty_required,
  cr.rate,
  cr.estimated_hours,
  cr.estimated_cost,
  cr.status,
  cr.approval_steps,
  cr.approval_level,
  cr.reason,
  cr.location,
  cr.created_at,
  cr.submitted_at,
  cr.approved_at,
  coalesce(a.assigned_count, 0)::integer as assigned_count,
  greatest(cr.qty_required - coalesce(a.assigned_count, 0), 0)::integer as remaining_count,
  nx.step               as current_step
from public.casual_requests cr
join public.hotels h       on h.id = cr.hotel_id
join public.departments d  on d.id = cr.department_id
join public.profiles p     on p.id = cr.requester_id
left join lateral (
  select count(*) as assigned_count
  from public.assignments asg
  where asg.request_id = cr.id and asg.status <> 'cancelled'
) a on true
left join lateral (
  select ra.step
  from public.request_approvals ra
  where ra.request_id = cr.id and ra.decision = 'pending'
  order by ra.step_order
  limit 1
) nx on true
where cr.deleted_at is null;

-- --- Assignment board ------------------------------------------------------
create or replace view public.v_assignment_detail
with (security_invoker = true) as
select
  asg.id,
  asg.request_id,
  cr.request_no,
  asg.hotel_id,
  asg.department_id,
  d.name              as department_name,
  asg.casual_id,
  c.casual_no,
  c.full_name         as casual_name,
  c.phone             as casual_phone,
  c.photo_path,
  c.avg_rating,
  asg.work_date,
  asg.shift_id,
  s.name              as shift_name,
  s.start_time        as shift_start,
  s.end_time          as shift_end,
  asg.rate,
  asg.status,
  t.id                as attendance_id,
  t.check_in,
  t.check_out,
  t.working_minutes,
  t.overtime_minutes,
  t.status            as attendance_status,
  e.id                as evaluation_id,
  e.final_rating,
  pay.id              as payment_id,
  pay.status          as payment_status,
  pay.total_amount
from public.assignments asg
join public.casual_requests cr on cr.id = asg.request_id
join public.casual_workers c   on c.id = asg.casual_id
join public.departments d      on d.id = asg.department_id
left join public.shifts s      on s.id = asg.shift_id
left join public.attendance t  on t.assignment_id = asg.id and t.attendance_date = asg.work_date
left join public.evaluations e on e.assignment_id = asg.id
left join public.payments pay  on pay.assignment_id = asg.id;

-- --- Casual directory with live performance figures ------------------------
create or replace view public.v_casual_directory
with (security_invoker = true) as
select
  c.id,
  c.casual_no,
  c.hotel_id,
  c.full_name,
  c.nickname,
  c.phone,
  c.email,
  c.gender,
  c.address,
  c.skills,
  c.preferred_department_id,
  d.name              as preferred_department_name,
  c.hotel_experience_years,
  c.photo_path,
  c.thumb_path,
  c.status,
  c.talent_class,
  c.avg_rating,
  c.attendance_rate,
  c.total_assignment,
  c.last_assignment_date,
  c.join_date,
  exists (
    select 1 from public.blacklist b
    where b.casual_id = c.id and b.released_at is null
  ) as is_blacklisted
from public.casual_workers c
left join public.departments d on d.id = c.preferred_department_id
where c.deleted_at is null;

-- --- Dashboard aggregation (PRD §7, §8) ------------------------------------
create or replace function public.dashboard_summary(
  p_hotel      uuid,
  p_from       date,
  p_to         date,
  p_department uuid default null
)
returns jsonb
language sql
stable
as $$
with params as (
  select p_hotel as hotel_id,
         p_from  as d_from,
         p_to    as d_to,
         p_department as dept,
         (now() at time zone coalesce(
            (select h.timezone from public.hotels h where h.id = p_hotel), 'Asia/Jakarta'))::date as today
),
req as (
  select r.* from public.casual_requests r, params
  where r.hotel_id = params.hotel_id
    and r.deleted_at is null
    and r.work_date between params.d_from and params.d_to
    and (params.dept is null or r.department_id = params.dept)
),
asg as (
  select a.* from public.assignments a, params
  where a.hotel_id = params.hotel_id
    and a.work_date between params.d_from and params.d_to
    and a.status <> 'cancelled'
    and (params.dept is null or a.department_id = params.dept)
),
att as (
  select t.* from public.attendance t, params
  where t.hotel_id = params.hotel_id
    and t.attendance_date between params.d_from and params.d_to
    and (params.dept is null or t.department_id = params.dept)
),
pay as (
  select p.* from public.payments p, params
  where p.hotel_id = params.hotel_id
    and p.work_date between params.d_from and params.d_to
    and (params.dept is null or p.department_id = params.dept)
),
bud as (
  select coalesce(sum(b.amount), 0) as amount
  from public.budgets b, params
  where b.hotel_id = params.hotel_id
    and (params.dept is null or b.department_id = params.dept or b.department_id is null)
    and make_date(b.period_year, b.period_month, 1)
        between date_trunc('month', params.d_from)::date and date_trunc('month', params.d_to)::date
),
kpi as (
  select
    (select count(*) from req)                                              as total_request,
    (select count(*) from req where status in
       ('submitted','hod_approval','hr_review','finance_verification','gm_approval'))
                                                                            as pending_approval,
    (select count(*) from req where status in
       ('approved','assigned','in_progress','completed','closed'))          as approved,
    (select coalesce(sum(qty_required), 0) from req)                        as casual_needed,
    (select count(*) from asg)                                              as casual_assigned,
    (select count(*) from att, params
       where att.attendance_date = params.today and att.status in ('present','late'))
                                                                            as casual_present_today,
    (select count(*) from att, params
       where att.attendance_date = params.today and att.status in ('absent','no_show'))
                                                                            as casual_absent_today,
    (select coalesce(sum(total_amount), 0) from pay)                        as casual_cost,
    (select coalesce(sum(estimated_cost), 0) from req
       where status in ('approved','assigned','in_progress','completed','closed'))
                                                                            as committed_cost,
    (select amount from bud)                                                as budget_amount
),
trend as (
  select coalesce(jsonb_agg(x order by x.bucket), '[]'::jsonb) as data
  from (
    select to_char(date_trunc('day', work_date), 'YYYY-MM-DD') as bucket,
           count(*)::integer as requests,
           coalesce(sum(qty_required), 0)::integer as qty
    from req group by 1
  ) x
),
by_department as (
  select coalesce(jsonb_agg(x order by x.qty desc), '[]'::jsonb) as data
  from (
    select d.name as department,
           count(*)::integer as requests,
           coalesce(sum(r.qty_required), 0)::integer as qty
    from req r join public.departments d on d.id = r.department_id
    group by d.name
  ) x
),
by_status as (
  select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) as data
  from (
    select status::text as status, count(*)::integer as total
    from req group by status
  ) x
),
cost_trend as (
  -- Budget is joined via LATERAL rather than a correlated subquery in the
  -- SELECT list: Postgres rejects a subquery that references p.work_date
  -- when the outer query is grouped by an expression derived from it
  -- (grouping by position 1 does not establish functional dependency).
  select coalesce(jsonb_agg(jsonb_build_object(
           'bucket', to_char(x.bucket_date, 'YYYY-MM'),
           'actual', x.actual,
           'budget', coalesce(bd.amount, 0)
         ) order by x.bucket_date), '[]'::jsonb) as data
  from (
    select date_trunc('month', p.work_date) as bucket_date,
           round(sum(p.total_amount), 2) as actual
    from pay p
    group by 1
  ) x
  left join lateral (
    select coalesce(sum(b.amount), 0) as amount
    from public.budgets b, params
    where b.hotel_id = params.hotel_id
      and make_date(b.period_year, b.period_month, 1) = x.bucket_date
  ) bd on true
),
attendance_mix as (
  select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) as data
  from (
    select status::text as status, count(*)::integer as total
    from att group by status
  ) x
),
top_casuals as (
  select coalesce(jsonb_agg(x order by x.assignments desc, x.rating desc), '[]'::jsonb) as data
  from (
    select c.full_name as name,
           c.casual_no,
           count(a.id)::integer as assignments,
           c.avg_rating as rating,
           c.attendance_rate
    from asg a join public.casual_workers c on c.id = a.casual_id
    group by c.id, c.full_name, c.casual_no, c.avg_rating, c.attendance_rate
    order by assignments desc, rating desc
    limit 10
  ) x
)
select jsonb_build_object(
  'kpi', jsonb_build_object(
      'total_request',        kpi.total_request,
      'pending_approval',     kpi.pending_approval,
      'approved',             kpi.approved,
      'casual_needed',        kpi.casual_needed,
      'casual_assigned',      kpi.casual_assigned,
      'casual_present_today', kpi.casual_present_today,
      'casual_absent_today',  kpi.casual_absent_today,
      'casual_cost',          kpi.casual_cost,
      'committed_cost',       kpi.committed_cost,
      'budget_amount',        kpi.budget_amount,
      'budget_remaining',     kpi.budget_amount - kpi.casual_cost
  ),
  'request_trend',   trend.data,
  'by_department',   by_department.data,
  'by_status',       by_status.data,
  'cost_trend',      cost_trend.data,
  'attendance_mix',  attendance_mix.data,
  'top_casuals',     top_casuals.data
)
from kpi, trend, by_department, by_status, cost_trend, attendance_mix, top_casuals;
$$;

grant execute on function public.dashboard_summary(uuid, date, date, uuid) to authenticated;

-- --- Analytics extras (PRD §37) -------------------------------------------
create or replace function public.analytics_summary(
  p_hotel uuid,
  p_from  date,
  p_to    date
)
returns jsonb
language sql
stable
as $$
with req as (
  select r.* from public.casual_requests r
  where r.hotel_id = p_hotel and r.deleted_at is null
    and r.work_date between p_from and p_to
),
appr as (
  select ra.request_id,
         extract(epoch from (max(ra.decided_at) - min(r.submitted_at))) / 3600.0 as hours
  from public.request_approvals ra
  join req r on r.id = ra.request_id
  where ra.decided_at is not null and r.submitted_at is not null
  group by ra.request_id
),
att as (
  select t.* from public.attendance t
  where t.hotel_id = p_hotel and t.attendance_date between p_from and p_to
)
select jsonb_build_object(
  'total_requests',        (select count(*) from req),
  'total_qty',             (select coalesce(sum(qty_required), 0) from req),
  'avg_qty_per_request',   (select round(coalesce(avg(qty_required), 0), 2) from req),
  'avg_approval_hours',    (select round(coalesce(avg(hours), 0)::numeric, 2) from appr),
  'attendance_rate',       (select case when count(*) = 0 then 0 else
                              round(count(*) filter (where status in ('present','late'))::numeric
                                    * 100 / count(*), 2) end from att),
  'no_show_rate',          (select case when count(*) = 0 then 0 else
                              round(count(*) filter (where status = 'no_show')::numeric
                                    * 100 / count(*), 2) end from att),
  'total_spend',           (select coalesce(sum(total_amount), 0) from public.payments
                              where hotel_id = p_hotel and work_date between p_from and p_to),
  'unpaid_amount',         (select coalesce(sum(total_amount), 0) from public.payments
                              where hotel_id = p_hotel and work_date between p_from and p_to
                                and status <> 'paid'),
  'active_casuals',        (select count(*) from public.casual_workers
                              where hotel_id = p_hotel and status = 'active' and deleted_at is null)
);
$$;

grant execute on function public.analytics_summary(uuid, date, date) to authenticated;

grant select on public.v_request_list, public.v_assignment_detail, public.v_casual_directory
  to authenticated;
