-- ===========================================================================
-- CASUAL REQUEST — 05. Triggers: timestamps, audit trail, identifiers,
-- derived attendance figures and casual performance rollups.
-- PRD §11, §21, §27, §34, §47, §48, §74
-- ===========================================================================

-- --- updated_at / updated_by ----------------------------------------------
create or replace function app.touch_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new.updated_by := coalesce(
      (select p.id from public.profiles p where p.id = auth.uid()),
      new.updated_by
    );
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'hotels','departments','profiles','shifts','rate_master','approval_rules',
    'settings','budgets','casual_workers','casual_requests','assignments',
    'attendance','evaluations','payments'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_touch_updated on public.%I', t);
    execute format(
      'create trigger trg_touch_updated before update on public.%I
       for each row execute function app.touch_updated()', t);
  end loop;
end $$;

-- --- Generic audit trail (PRD §74) ----------------------------------------
create or replace function app.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old  jsonb;
  v_new  jsonb;
  v_rec  jsonb;
  v_hotel uuid;
  v_changed text[];
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_rec := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key), '{}')
      into v_changed
    from jsonb_each(v_new) e(key, value)
    where v_old -> e.key is distinct from e.value
      and e.key not in ('updated_at','updated_by');

    -- Nothing of substance changed; skip the audit row.
    if v_changed = '{}'::text[] then
      return null;
    end if;
  end if;

  if v_rec ? 'hotel_id' then
    v_hotel := nullif(v_rec ->> 'hotel_id', '')::uuid;
  elsif tg_table_name = 'hotels' then
    v_hotel := nullif(v_rec ->> 'id', '')::uuid;
  end if;

  insert into public.audit_logs (
    changed_by, hotel_id, table_name, record_id, action,
    old_value, new_value, changed_fields
  ) values (
    (select p.id from public.profiles p where p.id = auth.uid()),
    v_hotel,
    tg_table_name,
    coalesce(v_rec ->> 'id', ''),
    tg_op,
    v_old,
    v_new,
    v_changed
  );

  return null;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'casual_requests','request_approvals','assignments','attendance','payments',
    'rate_master','budgets','profiles','user_roles','user_hotels','blacklist',
    'approval_rules','settings','hotels','casual_workers'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on public.%I
       for each row execute function app.write_audit()', t);
  end loop;
end $$;

-- --- Request ID generator (PRD §11) ---------------------------------------
-- Atomic: the upsert takes a row lock on the counter, so concurrent inserts
-- serialise instead of colliding on the unique request_no index.
create or replace function public.next_request_no(p_hotel uuid, p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_year integer := extract(year from p_date)::integer;
  v_month integer := extract(month from p_date)::integer;
  v_seq integer;
begin
  select h.code into v_code from public.hotels h where h.id = p_hotel;
  if v_code is null then
    raise exception 'Hotel not found: %', p_hotel using errcode = 'foreign_key_violation';
  end if;

  insert into public.request_number_sequences (hotel_id, period_year, period_month, last_value)
  values (p_hotel, v_year, v_month, 1)
  on conflict (hotel_id, period_year, period_month)
  do update set last_value = public.request_number_sequences.last_value + 1
  returning last_value into v_seq;

  return format('CRQ/%s/%s/%s/%s',
    v_code,
    v_year::text,
    lpad(v_month::text, 2, '0'),
    lpad(v_seq::text, 4, '0'));
end;
$$;

create or replace function app.set_request_no()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.request_no is null or btrim(new.request_no) = '' then
    new.request_no := public.next_request_no(new.hotel_id, coalesce(new.request_date, current_date));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_request_no on public.casual_requests;
create trigger trg_set_request_no before insert on public.casual_requests
for each row execute function app.set_request_no();

-- --- Casual ID generator (PRD §21) ----------------------------------------
create or replace function app.set_casual_no()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.casual_no is null or btrim(new.casual_no) = '' then
    new.casual_no := 'CSL-' || lpad(nextval('public.casual_no_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_casual_no on public.casual_workers;
create trigger trg_set_casual_no before insert on public.casual_workers
for each row execute function app.set_casual_no();

-- --- Attendance derived figures (PRD §27, §28) ----------------------------
create or replace function app.calc_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_standard integer;
  v_tolerance integer;
  v_gross integer;
begin
  select coalesce((value ->> 'standard_minutes')::integer, 480),
         coalesce((value ->> 'late_tolerance_minutes')::integer, 15)
    into v_standard, v_tolerance
  from public.settings
  where hotel_id = new.hotel_id and category = 'attendance' and key = 'rules';

  v_standard  := coalesce(v_standard, 480);
  v_tolerance := coalesce(v_tolerance, 15);

  if new.check_in is not null and new.check_out is not null then
    v_gross := floor(extract(epoch from (new.check_out - new.check_in)) / 60.0)::integer;
    new.working_minutes  := greatest(v_gross - coalesce(new.break_minutes, 0), 0);
    new.overtime_minutes := greatest(new.working_minutes - v_standard, 0);
  elsif new.check_in is null then
    new.working_minutes  := 0;
    new.overtime_minutes := 0;
  end if;

  if new.check_in is not null and new.scheduled_start is not null then
    new.late_minutes := greatest(
      floor(extract(epoch from (new.check_in - new.scheduled_start)) / 60.0)::integer, 0);
  end if;

  -- Only auto-classify while the record is still in an automatic state; an
  -- explicit sick/permission/absent decision by a supervisor is preserved.
  if new.status in ('scheduled','present','late') then
    if new.check_in is null then
      new.status := 'scheduled';
    elsif coalesce(new.late_minutes, 0) > v_tolerance then
      new.status := 'late';
    else
      new.status := 'present';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_calc_attendance on public.attendance;
create trigger trg_calc_attendance before insert or update on public.attendance
for each row execute function app.calc_attendance();

-- Keep assignment status in step with attendance (PRD §19).
create or replace function app.sync_assignment_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.assignments a
  set status = case
        when new.status in ('present','late') and new.check_out is not null then 'completed'
        when new.status in ('present','late') then 'present'
        when new.status in ('absent','no_show') then 'absent'
        else a.status
      end,
      updated_at = now()
  where a.id = new.assignment_id
    and a.status not in ('cancelled');
  return null;
end;
$$;

drop trigger if exists trg_sync_assignment_status on public.attendance;
create trigger trg_sync_assignment_status after insert or update of status, check_out on public.attendance
for each row execute function app.sync_assignment_status();

-- --- Casual performance rollup (PRD §21, §31, §34) ------------------------
create or replace function app.recalc_casual_stats(p_casual uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rating numeric(3,2);
  v_total integer;
  v_present integer;
  v_attendance numeric(5,2);
  v_last date;
begin
  if p_casual is null then
    return;
  end if;

  select round(coalesce(avg(e.final_rating), 0)::numeric, 2)
    into v_rating
  from public.evaluations e where e.casual_id = p_casual;

  select count(*) filter (where a.status <> 'cancelled'),
         max(a.work_date) filter (where a.status <> 'cancelled')
    into v_total, v_last
  from public.assignments a where a.casual_id = p_casual;

  select count(*)
    into v_present
  from public.attendance t
  where t.casual_id = p_casual and t.status in ('present','late');

  v_attendance := case
    when coalesce(v_total, 0) = 0 then 0
    else round((v_present::numeric * 100.0) / v_total::numeric, 2)
  end;

  update public.casual_workers c
  set avg_rating           = coalesce(v_rating, 0),
      total_assignment     = coalesce(v_total, 0),
      total_present        = coalesce(v_present, 0),
      attendance_rate      = least(v_attendance, 100),
      last_assignment_date = v_last,
      talent_class = case
        when c.status = 'blacklisted' then 'do_not_assign'::public.talent_class
        when coalesce(v_total, 0) < 3 then 'new'::public.talent_class
        when coalesce(v_rating, 0) >= 4.0 then 'recommended'::public.talent_class
        when coalesce(v_rating, 0) > 0 and v_rating < 3.0 then 'on_review'::public.talent_class
        else 'available'::public.talent_class
      end,
      updated_at = now()
  where c.id = p_casual;
end;
$$;

create or replace function app.trg_recalc_casual_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.recalc_casual_stats(coalesce(new.casual_id, old.casual_id));
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['evaluations','attendance','assignments'] loop
    execute format('drop trigger if exists trg_casual_stats on public.%I', t);
    execute format(
      'create trigger trg_casual_stats after insert or update or delete on public.%I
       for each row execute function app.trg_recalc_casual_stats()', t);
  end loop;
end $$;

-- Blacklisting flips the worker status and talent class in one place.
create or replace function app.sync_blacklist_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_casual uuid := coalesce(new.casual_id, old.casual_id);
  v_active boolean;
begin
  select exists (
    select 1 from public.blacklist b
    where b.casual_id = v_casual and b.released_at is null
  ) into v_active;

  update public.casual_workers c
  set status = case
        when v_active then 'blacklisted'::public.casual_status
        when c.status = 'blacklisted' then 'active'::public.casual_status
        else c.status
      end,
      talent_class = case
        when v_active then 'do_not_assign'::public.talent_class
        when c.talent_class = 'do_not_assign' then 'on_review'::public.talent_class
        else c.talent_class
      end,
      updated_at = now()
  where c.id = v_casual;

  return null;
end;
$$;

drop trigger if exists trg_sync_blacklist on public.blacklist;
create trigger trg_sync_blacklist after insert or update or delete on public.blacklist
for each row execute function app.sync_blacklist_status();

-- --- New auth user -> placeholder profile (PRD §40, §42) ------------------
-- A Google sign-in by an unknown person lands here with status 'pending', so
-- the app can show Access Denied instead of failing on a missing profile row.
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, photo_path, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
exception
  when unique_violation then
    -- An operator pre-created a profile with this e-mail under another id.
    -- Leave it alone; the sign-in will be denied and surfaced to an admin.
    return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user after insert on auth.users
for each row execute function app.handle_new_auth_user();
