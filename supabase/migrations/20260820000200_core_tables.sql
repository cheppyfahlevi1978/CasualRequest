-- ===========================================================================
-- CASUAL REQUEST — 02. Core tables (identity, tenancy, RBAC, master data)
-- PRD §45
-- ===========================================================================

-- --- Global application configuration --------------------------------------
create table if not exists public.app_config (
  key           text primary key,
  value         jsonb       not null default '{}'::jsonb,
  description   text,
  is_secret     boolean     not null default false,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.app_config is
  'Global non-secret application configuration. Secrets live in Vercel/Supabase env, never here.';

-- --- Hotels (tenants) ------------------------------------------------------
create table if not exists public.hotels (
  id            uuid primary key default gen_random_uuid(),
  code          text        not null,
  name          text        not null,
  legal_name    text,
  address       text,
  city          text,
  phone         text,
  email         text,
  logo_path     text,
  photo_path    text,
  timezone      text        not null default 'Asia/Jakarta',
  currency      text        not null default 'IDR',
  locale        text        not null default 'id',
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  geofence_radius_m integer not null default 150,
  status        public.hotel_status not null default 'active',
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  deleted_at    timestamptz,
  deleted_by    uuid,
  constraint hotels_code_format check (code ~ '^[A-Z0-9]{2,10}$'),
  constraint hotels_geofence_positive check (geofence_radius_m > 0)
);
create unique index if not exists hotels_code_key on public.hotels (code) where deleted_at is null;
create index if not exists hotels_status_idx on public.hotels (status) where deleted_at is null;

-- --- Departments -----------------------------------------------------------
create table if not exists public.departments (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  code          text        not null,
  name          text        not null,
  cost_center   text,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 100,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  deleted_at    timestamptz,
  deleted_by    uuid
);
create unique index if not exists departments_hotel_code_key
  on public.departments (hotel_id, code) where deleted_at is null;
create index if not exists departments_hotel_idx on public.departments (hotel_id) where deleted_at is null;

-- --- Profiles (1:1 with auth.users) ----------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text        not null,
  full_name         text        not null default '',
  phone             text,
  employee_id       text,
  position          text,
  photo_path        text,
  primary_hotel_id  uuid references public.hotels(id) on delete set null,
  department_id     uuid references public.departments(id) on delete set null,
  status            public.user_status not null default 'pending',
  locale            text        not null default 'id',
  theme             text        not null default 'system',
  notify_email      boolean     not null default true,
  notify_inapp      boolean     not null default true,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  deleted_at        timestamptz,
  deleted_by        uuid,
  constraint profiles_theme_check check (theme in ('light','dark','system')),
  constraint profiles_locale_check check (locale in ('id','en'))
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));
create unique index if not exists profiles_employee_id_key
  on public.profiles (primary_hotel_id, employee_id)
  where employee_id is not null and deleted_at is null;
create index if not exists profiles_hotel_idx on public.profiles (primary_hotel_id) where deleted_at is null;
create index if not exists profiles_department_idx on public.profiles (department_id) where deleted_at is null;
create index if not exists profiles_status_idx on public.profiles (status);

-- Audit-column FKs, added now that profiles exists.
alter table public.hotels
  drop constraint if exists hotels_created_by_fkey;
alter table public.hotels
  add constraint hotels_created_by_fkey foreign key (created_by)
  references public.profiles(id) on delete set null;

alter table public.departments
  drop constraint if exists departments_created_by_fkey;
alter table public.departments
  add constraint departments_created_by_fkey foreign key (created_by)
  references public.profiles(id) on delete set null;

-- --- RBAC ------------------------------------------------------------------
create table if not exists public.roles (
  id            uuid primary key default gen_random_uuid(),
  code          text        not null unique,
  name          text        not null,
  description   text,
  rank          integer     not null default 100,
  is_system     boolean     not null default false,
  created_at    timestamptz not null default now()
);
comment on column public.roles.rank is 'Lower rank means higher authority. super_admin = 0.';

create table if not exists public.permissions (
  id            uuid primary key default gen_random_uuid(),
  code          text        not null unique,
  module        text        not null,
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create index if not exists role_permissions_permission_idx on public.role_permissions (permission_id);

-- A user holds a role globally (hotel_id null, super admin) or scoped to one hotel.
create table if not exists public.user_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role_id       uuid not null references public.roles(id) on delete cascade,
  hotel_id      uuid references public.hotels(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null
);
create unique index if not exists user_roles_unique_scoped
  on public.user_roles (user_id, role_id, hotel_id) where hotel_id is not null;
create unique index if not exists user_roles_unique_global
  on public.user_roles (user_id, role_id) where hotel_id is null;
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_hotel_idx on public.user_roles (hotel_id);

create table if not exists public.user_hotels (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  hotel_id      uuid not null references public.hotels(id) on delete cascade,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  primary key (user_id, hotel_id)
);
create index if not exists user_hotels_hotel_idx on public.user_hotels (hotel_id);

-- --- Shifts & rates --------------------------------------------------------
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  code          text        not null,
  name          text        not null,
  start_time    time        not null,
  end_time      time        not null,
  break_minutes integer     not null default 60,
  crosses_midnight boolean  not null default false,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint shifts_break_nonneg check (break_minutes >= 0)
);
create unique index if not exists shifts_hotel_code_key on public.shifts (hotel_id, code);

create table if not exists public.rate_master (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid        not null references public.hotels(id) on delete cascade,
  department_id  uuid references public.departments(id) on delete set null,
  position       text        not null default 'GENERAL',
  rate_type      public.rate_type not null default 'daily',
  rate           numeric(14,2) not null,
  overtime_rate  numeric(14,2) not null default 0,
  meal_allowance numeric(14,2) not null default 0,
  transport_allowance numeric(14,2) not null default 0,
  effective_from date        not null default current_date,
  effective_to   date,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles(id) on delete set null,
  constraint rate_master_rate_nonneg check (rate >= 0 and overtime_rate >= 0
    and meal_allowance >= 0 and transport_allowance >= 0),
  constraint rate_master_period check (effective_to is null or effective_to >= effective_from)
);
create index if not exists rate_master_lookup_idx
  on public.rate_master (hotel_id, department_id, position, effective_from desc);

-- --- Approval rules (PRD §13 conditional approval) -------------------------
create table if not exists public.approval_rules (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  name          text        not null,
  min_amount    numeric(14,2) not null default 0,
  max_amount    numeric(14,2),
  steps         public.approval_step[] not null,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint approval_rules_amounts check (max_amount is null or max_amount >= min_amount),
  constraint approval_rules_min_nonneg check (min_amount >= 0),
  constraint approval_rules_steps_nonempty check (array_length(steps, 1) >= 1)
);
create index if not exists approval_rules_hotel_idx on public.approval_rules (hotel_id, sort_order);

-- --- Per-hotel settings ----------------------------------------------------
create table if not exists public.settings (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid references public.hotels(id) on delete cascade,
  category      text        not null,
  key           text        not null,
  value         jsonb       not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);
-- NULLS NOT DISTINCT (PG15+) keeps global settings (hotel_id is null) unique on
-- real columns, which is what PostgREST needs to infer the conflict target.
create unique index if not exists settings_scope_key
  on public.settings (hotel_id, category, key) nulls not distinct;

-- --- Budgets ---------------------------------------------------------------
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid        not null references public.hotels(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  period_year   integer     not null,
  period_month  integer     not null,
  amount        numeric(14,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null,
  constraint budgets_month_range check (period_month between 1 and 12),
  constraint budgets_year_range check (period_year between 2000 and 2200),
  constraint budgets_amount_nonneg check (amount >= 0)
);
create unique index if not exists budgets_scope_key
  on public.budgets (hotel_id, department_id, period_year, period_month) nulls not distinct;
