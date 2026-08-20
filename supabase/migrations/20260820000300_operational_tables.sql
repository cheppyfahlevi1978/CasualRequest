-- ===========================================================================
-- CASUAL REQUEST — 03. Operational tables
-- PRD §18-21, §24, §29, §33, §39, §46-49
-- ===========================================================================

-- --- Casual worker master --------------------------------------------------
create table if not exists public.casual_workers (
  id                    uuid primary key default gen_random_uuid(),
  casual_no             text        not null,
  hotel_id              uuid        not null references public.hotels(id) on delete restrict,
  auth_user_id          uuid references auth.users(id) on delete set null,
  full_name             text        not null,
  nickname              text,
  place_of_birth        text,
  date_of_birth         date,
  gender                public.gender_type,
  phone                 text,
  email                 text,
  address               text,
  national_id_masked    text,
  photo_path            text,
  thumb_path            text,
  preferred_department_id uuid references public.departments(id) on delete set null,
  skills                text[]      not null default '{}',
  hotel_experience_years numeric(4,1) not null default 0,
  previous_employer     text,
  join_date             date        not null default current_date,
  emergency_name        text,
  emergency_relationship text,
  emergency_phone       text,
  status                public.casual_status not null default 'active',
  talent_class          public.talent_class  not null default 'new',
  avg_rating            numeric(3,2) not null default 0,
  attendance_rate       numeric(5,2) not null default 0,
  total_assignment      integer     not null default 0,
  total_present         integer     not null default 0,
  last_assignment_date  date,
  notes                 text,
  created_at            timestamptz not null default now(),
  created_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id) on delete set null,
  deleted_at            timestamptz,
  deleted_by            uuid references public.profiles(id) on delete set null,
  constraint casual_workers_rating_range check (avg_rating >= 0 and avg_rating <= 5),
  constraint casual_workers_attendance_range check (attendance_rate >= 0 and attendance_rate <= 100),
  constraint casual_workers_counters_nonneg check (total_assignment >= 0 and total_present >= 0),
  constraint casual_workers_experience_nonneg check (hotel_experience_years >= 0)
);
create unique index if not exists casual_workers_no_key on public.casual_workers (casual_no);
create index if not exists casual_workers_hotel_status_idx
  on public.casual_workers (hotel_id, status) where deleted_at is null;
create index if not exists casual_workers_talent_idx
  on public.casual_workers (hotel_id, talent_class) where deleted_at is null;
create index if not exists casual_workers_name_idx
  on public.casual_workers (hotel_id, lower(full_name)) where deleted_at is null;
create index if not exists casual_workers_dept_idx
  on public.casual_workers (preferred_department_id) where deleted_at is null;
create index if not exists casual_workers_auth_idx
  on public.casual_workers (auth_user_id) where auth_user_id is not null;

-- --- Blacklist -------------------------------------------------------------
create table if not exists public.blacklist (
  id            uuid primary key default gen_random_uuid(),
  casual_id     uuid        not null references public.casual_workers(id) on delete cascade,
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  reason        text        not null,
  effective_date date       not null default current_date,
  released_at   timestamptz,
  released_by   uuid references public.profiles(id) on delete set null,
  release_reason text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  constraint blacklist_reason_not_blank check (length(btrim(reason)) >= 5)
);
create unique index if not exists blacklist_active_key
  on public.blacklist (casual_id, hotel_id) where released_at is null;
create index if not exists blacklist_hotel_idx on public.blacklist (hotel_id);

-- --- Casual requests (PRD §46) ---------------------------------------------
create table if not exists public.casual_requests (
  id                uuid primary key default gen_random_uuid(),
  request_no        text        not null,
  hotel_id          uuid        not null references public.hotels(id) on delete restrict,
  request_date      date        not null default current_date,
  requester_id      uuid        not null references public.profiles(id) on delete restrict,
  department_id     uuid        not null references public.departments(id) on delete restrict,
  position_required text        not null default 'GENERAL',
  request_type      public.request_type not null default 'operational',
  event_name        text,
  work_date         date        not null,
  start_time        time        not null,
  end_time          time        not null,
  shift_id          uuid references public.shifts(id) on delete set null,
  qty_required      integer     not null,
  gender_preference public.gender_type,
  experience_required text,
  rate              numeric(14,2) not null default 0,
  estimated_hours   numeric(6,2) not null default 8,
  estimated_cost    numeric(14,2) not null default 0,
  reason            text        not null,
  location          text,
  notes             text,
  status            public.request_status not null default 'draft',
  approval_steps    public.approval_step[] not null default '{}',
  approval_level    integer     not null default 0,
  submitted_at      timestamptz,
  approved_at       timestamptz,
  closed_at         timestamptz,
  cancel_reason     text,
  reject_reason     text,
  created_at        timestamptz not null default now(),
  created_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id) on delete set null,
  deleted_at        timestamptz,
  deleted_by        uuid references public.profiles(id) on delete set null,
  constraint casual_requests_qty_positive check (qty_required > 0),
  constraint casual_requests_cost_nonneg check (estimated_cost >= 0 and rate >= 0),
  constraint casual_requests_hours_positive check (estimated_hours > 0),
  constraint casual_requests_level_nonneg check (approval_level >= 0),
  constraint casual_requests_event_name check (request_type <> 'event' or length(btrim(coalesce(event_name,''))) > 0),
  constraint casual_requests_reason_not_blank check (length(btrim(reason)) >= 3)
);
create unique index if not exists casual_requests_no_key on public.casual_requests (request_no);
create index if not exists casual_requests_hotel_workdate_idx
  on public.casual_requests (hotel_id, work_date) where deleted_at is null;
create index if not exists casual_requests_hotel_status_idx
  on public.casual_requests (hotel_id, status) where deleted_at is null;
create index if not exists casual_requests_dept_workdate_idx
  on public.casual_requests (department_id, work_date) where deleted_at is null;
create index if not exists casual_requests_requester_idx
  on public.casual_requests (requester_id, created_at desc) where deleted_at is null;
create index if not exists casual_requests_status_created_idx
  on public.casual_requests (status, created_at desc) where deleted_at is null;

-- Monotonic per hotel/year/month counter backing the Request ID (PRD §11).
create table if not exists public.request_number_sequences (
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  period_year   integer not null,
  period_month  integer not null,
  last_value    integer not null default 0,
  primary key (hotel_id, period_year, period_month)
);

create sequence if not exists public.casual_no_seq start 1;

-- --- Request approvals (PRD §17) -------------------------------------------
create table if not exists public.request_approvals (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid        not null references public.casual_requests(id) on delete cascade,
  hotel_id        uuid        not null references public.hotels(id) on delete cascade,
  step            public.approval_step not null,
  step_order      integer     not null,
  decision        public.approval_decision not null default 'pending',
  approver_id     uuid references public.profiles(id) on delete set null,
  approver_email  text,
  approver_role   text,
  remark          text,
  decided_at      timestamptz,
  session_info    jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint request_approvals_order_positive check (step_order >= 1),
  constraint request_approvals_decided check (
    decision = 'pending' or (approver_id is not null and decided_at is not null)
  )
);
create unique index if not exists request_approvals_step_key
  on public.request_approvals (request_id, step_order);
create index if not exists request_approvals_pending_idx
  on public.request_approvals (hotel_id, step, decision) where decision = 'pending';
create index if not exists request_approvals_request_idx on public.request_approvals (request_id);

-- --- Assignments (PRD §19) -------------------------------------------------
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid        not null references public.casual_requests(id) on delete cascade,
  casual_id     uuid        not null references public.casual_workers(id) on delete restrict,
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  department_id uuid        not null references public.departments(id) on delete restrict,
  work_date     date        not null,
  shift_id      uuid references public.shifts(id) on delete set null,
  rate          numeric(14,2) not null default 0,
  status        public.assignment_status not null default 'assigned',
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null,
  constraint assignments_rate_nonneg check (rate >= 0)
);
-- One casual can only be booked once per request, and once per calendar day.
create unique index if not exists assignments_request_casual_key
  on public.assignments (request_id, casual_id);
create unique index if not exists assignments_casual_day_key
  on public.assignments (casual_id, work_date) where status <> 'cancelled';
create index if not exists assignments_hotel_date_idx on public.assignments (hotel_id, work_date);
create index if not exists assignments_request_idx on public.assignments (request_id);
create index if not exists assignments_casual_idx on public.assignments (casual_id, work_date desc);
create index if not exists assignments_status_idx on public.assignments (hotel_id, status);

-- --- Attendance (PRD §47) --------------------------------------------------
create table if not exists public.attendance (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid        not null references public.assignments(id) on delete cascade,
  request_id      uuid        not null references public.casual_requests(id) on delete cascade,
  casual_id       uuid        not null references public.casual_workers(id) on delete restrict,
  hotel_id        uuid        not null references public.hotels(id) on delete cascade,
  department_id   uuid        not null references public.departments(id) on delete restrict,
  attendance_date date        not null,
  shift_id        uuid references public.shifts(id) on delete set null,
  scheduled_start timestamptz,
  check_in        timestamptz,
  check_out       timestamptz,
  break_minutes   integer     not null default 0,
  working_minutes integer     not null default 0,
  overtime_minutes integer    not null default 0,
  late_minutes    integer     not null default 0,
  status          public.attendance_status not null default 'scheduled',
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  location_validation public.location_check not null default 'not_required',
  check_in_method text        not null default 'manual',
  remark          text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,
  constraint attendance_break_nonneg check (break_minutes >= 0),
  constraint attendance_working_nonneg check (working_minutes >= 0),
  constraint attendance_overtime_nonneg check (overtime_minutes >= 0),
  constraint attendance_late_nonneg check (late_minutes >= 0),
  constraint attendance_checkout_after_checkin
    check (check_in is null or check_out is null or check_out >= check_in),
  constraint attendance_method_check check (check_in_method in ('manual','qr','self','import'))
);
create unique index if not exists attendance_assignment_date_key
  on public.attendance (assignment_id, attendance_date);
create index if not exists attendance_hotel_date_idx on public.attendance (hotel_id, attendance_date);
create index if not exists attendance_casual_idx on public.attendance (casual_id, attendance_date desc);
create index if not exists attendance_status_idx on public.attendance (hotel_id, status, attendance_date);
create index if not exists attendance_dept_idx on public.attendance (department_id, attendance_date);

-- --- Evaluations (PRD §33-34) ----------------------------------------------
create table if not exists public.evaluations (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid        not null references public.assignments(id) on delete cascade,
  request_id      uuid        not null references public.casual_requests(id) on delete cascade,
  casual_id       uuid        not null references public.casual_workers(id) on delete cascade,
  hotel_id        uuid        not null references public.hotels(id) on delete cascade,
  department_id   uuid        not null references public.departments(id) on delete restrict,
  evaluator_id    uuid        not null references public.profiles(id) on delete restrict,
  score_attendance    smallint not null,
  score_discipline    smallint not null,
  score_attitude      smallint not null,
  score_grooming      smallint not null,
  score_skill         smallint not null,
  score_teamwork      smallint not null,
  score_communication smallint not null,
  score_overall       smallint not null,
  final_rating    numeric(3,2) generated always as (
    round((score_attendance + score_discipline + score_attitude + score_grooming
         + score_skill + score_teamwork + score_communication + score_overall)::numeric / 8.0, 2)
  ) stored,
  strength        text,
  improvement     text,
  recommendation  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,
  constraint evaluations_scores_range check (
    score_attendance between 1 and 5 and score_discipline between 1 and 5 and
    score_attitude between 1 and 5 and score_grooming between 1 and 5 and
    score_skill between 1 and 5 and score_teamwork between 1 and 5 and
    score_communication between 1 and 5 and score_overall between 1 and 5
  ),
  constraint evaluations_recommendation_check check (
    recommendation is null or recommendation in ('rehire','consider','do_not_rehire')
  )
);
create unique index if not exists evaluations_assignment_key on public.evaluations (assignment_id);
create index if not exists evaluations_casual_idx on public.evaluations (casual_id, created_at desc);
create index if not exists evaluations_hotel_idx on public.evaluations (hotel_id, created_at desc);

-- --- Payments (PRD §29-30) -------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid        not null references public.assignments(id) on delete cascade,
  request_id      uuid        not null references public.casual_requests(id) on delete cascade,
  casual_id       uuid        not null references public.casual_workers(id) on delete restrict,
  hotel_id        uuid        not null references public.hotels(id) on delete cascade,
  department_id   uuid        not null references public.departments(id) on delete restrict,
  work_date       date        not null,
  rate_type       public.rate_type not null default 'daily',
  rate            numeric(14,2) not null default 0,
  worked_hours    numeric(6,2) not null default 0,
  overtime_hours  numeric(6,2) not null default 0,
  basic_amount    numeric(14,2) not null default 0,
  allowance       numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  deduction       numeric(14,2) not null default 0,
  total_amount    numeric(14,2) generated always as
                    (basic_amount + allowance + overtime_amount - deduction) stored,
  status          public.payment_status not null default 'pending',
  verified_by     uuid references public.profiles(id) on delete set null,
  verified_at     timestamptz,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  paid_by         uuid references public.profiles(id) on delete set null,
  paid_at         timestamptz,
  payment_reference text,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,
  constraint payments_amounts_nonneg check (
    rate >= 0 and worked_hours >= 0 and overtime_hours >= 0 and basic_amount >= 0
    and allowance >= 0 and overtime_amount >= 0 and deduction >= 0
  )
);
create unique index if not exists payments_assignment_key on public.payments (assignment_id);
create index if not exists payments_hotel_status_idx on public.payments (hotel_id, status, work_date);
create index if not exists payments_casual_idx on public.payments (casual_id, work_date desc);
create index if not exists payments_dept_idx on public.payments (department_id, work_date);

-- --- Documents (PRD §22) ---------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  casual_id     uuid references public.casual_workers(id) on delete cascade,
  request_id    uuid references public.casual_requests(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  bucket_name   text        not null,
  object_path   text        not null,
  file_name     text        not null,
  mime_type     text        not null,
  file_size     bigint      not null default 0,
  checksum      text,
  title         text,
  expires_at    date,
  is_private    boolean     not null default true,
  is_deleted    boolean     not null default false,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles(id) on delete set null,
  constraint documents_size_nonneg check (file_size >= 0),
  constraint documents_has_owner check (
    casual_id is not null or request_id is not null
    or assignment_id is not null or profile_id is not null
  )
);
create unique index if not exists documents_object_key on public.documents (bucket_name, object_path);
create index if not exists documents_casual_idx on public.documents (casual_id, document_type) where is_deleted = false;
create index if not exists documents_request_idx on public.documents (request_id) where is_deleted = false;
create index if not exists documents_hotel_type_idx on public.documents (hotel_id, document_type) where is_deleted = false;
create index if not exists documents_expiry_idx on public.documents (expires_at) where is_deleted = false and expires_at is not null;

-- --- Notifications (PRD §50) -----------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  hotel_id      uuid references public.hotels(id) on delete cascade,
  type          text        not null,
  title         text        not null,
  body          text,
  link          text,
  dedupe_key    text,
  is_read       boolean     not null default false,
  read_at       timestamptz,
  email_status  text        not null default 'skipped',
  created_at    timestamptz not null default now(),
  constraint notifications_email_status_check
    check (email_status in ('skipped','queued','sent','failed'))
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;
-- Idempotency guard so a retried workflow cannot double-notify (PRD §51).
create unique index if not exists notifications_dedupe_key
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

-- --- Logs (PRD §48, §54, §74) ----------------------------------------------
create table if not exists public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid references public.profiles(id) on delete set null,
  hotel_id      uuid references public.hotels(id) on delete set null,
  action        text        not null,
  module        text        not null,
  record_id     text,
  description   text,
  metadata      jsonb       not null default '{}'::jsonb,
  correlation_id text
);
create index if not exists activity_logs_hotel_created_idx on public.activity_logs (hotel_id, created_at desc);
create index if not exists activity_logs_user_idx on public.activity_logs (user_id, created_at desc);
create index if not exists activity_logs_module_idx on public.activity_logs (module, created_at desc);
create index if not exists activity_logs_record_idx on public.activity_logs (record_id);

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  changed_at    timestamptz not null default now(),
  changed_by    uuid references public.profiles(id) on delete set null,
  hotel_id      uuid references public.hotels(id) on delete set null,
  table_name    text        not null,
  record_id     text        not null,
  action        text        not null,
  old_value     jsonb,
  new_value     jsonb,
  changed_fields text[],
  constraint audit_logs_action_check check (action in ('INSERT','UPDATE','DELETE'))
);
create index if not exists audit_logs_record_idx on public.audit_logs (table_name, record_id, changed_at desc);
create index if not exists audit_logs_hotel_idx on public.audit_logs (hotel_id, changed_at desc);

create table if not exists public.system_logs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  level         text        not null default 'error',
  source        text        not null default 'app',
  message       text        not null,
  context       jsonb       not null default '{}'::jsonb,
  user_id       uuid references public.profiles(id) on delete set null,
  correlation_id text,
  constraint system_logs_level_check check (level in ('debug','info','warn','error','fatal'))
);
create index if not exists system_logs_created_idx on public.system_logs (created_at desc);
create index if not exists system_logs_level_idx on public.system_logs (level, created_at desc);
