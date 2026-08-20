-- ===========================================================================
-- CASUAL REQUEST — development seed
-- Runs automatically on `supabase db reset` (local only). Safe to re-run.
-- Production reference data lives in migration 10, not here.
-- ===========================================================================

insert into public.hotels (code, name, legal_name, address, city, phone, email,
                           timezone, currency, latitude, longitude, geofence_radius_m)
values
  ('APK', 'ASTON Pekalongan Syariah Hotel & Conference Center',
   'PT Aston Pekalongan', 'Jl. Gajahmada No. 100, Pekalongan', 'Pekalongan',
   '+62 285 123456', 'fo@astonpekalongan.example', 'Asia/Jakarta', 'IDR',
   -6.8886000, 109.6753000, 150),
  ('AMP', 'ASTON Mampang',
   'PT Aston Mampang', 'Jl. Mampang Prapatan Raya No. 1, Jakarta Selatan', 'Jakarta',
   '+62 21 7654321', 'fo@astonmampang.example', 'Asia/Jakarta', 'IDR',
   -6.2419000, 106.8226000, 150)
on conflict do nothing;

-- Departments, shifts, rates, approval thresholds and settings are created by
-- the after-insert trigger (public.bootstrap_hotel_defaults).

-- Casual budget for the current and next month, per hotel.
insert into public.budgets (hotel_id, period_year, period_month, amount, notes)
select h.id,
       extract(year from d)::integer,
       extract(month from d)::integer,
       45000000,
       'Seeded development budget'
from public.hotels h
cross join generate_series(
  date_trunc('month', current_date),
  date_trunc('month', current_date) + interval '1 month',
  interval '1 month'
) as d
on conflict do nothing;

-- A small talent pool so the Assignment and Talent Pool screens are not empty.
insert into public.casual_workers (
  hotel_id, full_name, nickname, gender, phone, email, address,
  preferred_department_id, skills, hotel_experience_years, join_date, status
)
select
  h.id,
  v.full_name,
  v.nickname,
  v.gender::public.gender_type,
  v.phone,
  lower(replace(v.full_name, ' ', '.')) || '@casual.example',
  'Pekalongan',
  (select d.id from public.departments d where d.hotel_id = h.id and d.code = v.dept),
  v.skills,
  v.years,
  current_date - interval '6 months',
  'active'
from public.hotels h
cross join (values
  ('Adi Nugroho',     'Adi',   'male',   '+62 812 1000 0001', 'FB',  array['banquet','service'],       2.0),
  ('Bayu Saputra',    'Bayu',  'male',   '+62 812 1000 0002', 'HK',  array['room attendant'],          1.5),
  ('Citra Lestari',   'Citra', 'female', '+62 812 1000 0003', 'FO',  array['greeter','usher'],         3.0),
  ('Dewi Anggraini',  'Dewi',  'female', '+62 812 1000 0004', 'BQT', array['banquet','waitress'],      0.5),
  ('Eko Prasetyo',    'Eko',   'male',   '+62 812 1000 0005', 'KIT', array['steward','kitchen helper'],4.0),
  ('Fitri Handayani', 'Fitri', 'female', '+62 812 1000 0006', 'HK',  array['public area'],             1.0),
  ('Gilang Ramadhan', 'Gilang','male',   '+62 812 1000 0007', 'ENG', array['handyman'],                5.0),
  ('Hana Puspita',    'Hana',  'female', '+62 812 1000 0008', 'FB',  array['barista','service'],       2.5)
) as v(full_name, nickname, gender, phone, dept, skills, years)
where h.code = 'APK'
  and not exists (
    select 1 from public.casual_workers c
    where c.hotel_id = h.id and c.full_name = v.full_name
  );
