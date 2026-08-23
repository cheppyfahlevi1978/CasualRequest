-- ===========================================================================
-- CASUAL REQUEST — Bootstrap Super Admin pertama
-- ===========================================================================
-- Masalah yang diselesaikan: `app.handle_new_auth_user()` selalu membuat profil
-- baru berstatus 'pending' tanpa peran dan tanpa hotel (PRD §42 — registrasi
-- bukan otorisasi). Aturan itu benar, tapi pada basis data kosong tidak ada
-- satu pun Super Admin yang bisa mengaktifkan pendaftar pertama, sehingga
-- aplikasi terkunci total.
--
-- Solusinya adalah pintu bootstrap sekali pakai: satu alamat email yang
-- ditetapkan administrator boleh langsung menjadi Super Admin aktif, dan HANYA
-- selama belum ada Super Admin aktif lain. Begitu kursi itu terisi, pintu ini
-- tertutup sendiri — mendaftar ulang dengan email yang sama pun tidak memberi
-- hak apa pun.
-- ===========================================================================

insert into public.app_config (key, value, description)
values (
  'auth.bootstrap_super_admin_email',
  '"cheppyfahlevi1978@gmail.com"'::jsonb,
  'Email yang boleh mengklaim kursi Super Admin pertama. Hanya berlaku selama belum ada Super Admin aktif. Kosongkan ("") untuk menutup pintu ini secara permanen.'
)
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Mengangkat satu profil menjadi Super Admin aktif dengan akses seluruh hotel.
-- Idempoten: dipanggil dua kali tidak menggandakan peran atau akses hotel.
-- Mengembalikan true bila kursi benar-benar diklaim pada pemanggilan ini.
-- ---------------------------------------------------------------------------
create or replace function app.claim_bootstrap_super_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email          text;
  v_bootstrap      text;
  v_role_id        uuid;
  v_default_hotel  uuid;
begin
  -- Kursi sudah terisi? Pintu tertutup.
  if exists (
    select 1
    from public.user_roles ur
    join public.roles r    on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where r.code = 'super_admin'
      and p.status = 'active'
      and p.deleted_at is null
  ) then
    return false;
  end if;

  select lower(trim(p.email)) into v_email
  from public.profiles p
  where p.id = p_user_id;

  if v_email is null or v_email = '' then
    return false;
  end if;

  select lower(trim(c.value #>> '{}')) into v_bootstrap
  from public.app_config c
  where c.key = 'auth.bootstrap_super_admin_email';

  if v_bootstrap is null or v_bootstrap = '' or v_bootstrap <> v_email then
    return false;
  end if;

  select r.id into v_role_id from public.roles r where r.code = 'super_admin';
  if v_role_id is null then
    return false;
  end if;

  -- Hotel default: yang ditandai default, kalau tidak ada ambil kode terkecil.
  select h.id into v_default_hotel
  from public.hotels h
  where h.deleted_at is null and h.status = 'active'
  order by h.code
  limit 1;

  update public.profiles p
     set status = 'active',
         primary_hotel_id = coalesce(p.primary_hotel_id, v_default_hotel),
         updated_at = now()
   where p.id = p_user_id;

  insert into public.user_roles (user_id, role_id, hotel_id)
  values (p_user_id, v_role_id, null)
  on conflict do nothing;

  -- Super Admin melihat semua hotel lewat is_super_admin(), tapi baris
  -- user_hotels tetap diisi agar pemilih hotel di topbar punya nilai awal.
  insert into public.user_hotels (user_id, hotel_id, is_default)
  select p_user_id, h.id, (h.id = v_default_hotel)
  from public.hotels h
  where h.deleted_at is null
  on conflict do nothing;

  insert into public.activity_logs (user_id, action, module, record_id, description)
  values (
    p_user_id,
    'CHANGE SETTING',
    'auth',
    p_user_id::text,
    'Kursi Super Admin pertama diklaim melalui bootstrap (' || v_email || ')'
  );

  return true;
end;
$$;

revoke all on function app.claim_bootstrap_super_admin(uuid) from public, anon, authenticated;

comment on function app.claim_bootstrap_super_admin(uuid) is
  'Sekali pakai: mengangkat pendaftar dengan email bootstrap menjadi Super Admin aktif selama belum ada Super Admin aktif.';

-- ---------------------------------------------------------------------------
-- Trigger pendaftaran: perilaku lama dipertahankan persis, ditambah satu
-- pemanggilan bootstrap di akhir.
-- ---------------------------------------------------------------------------
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

  perform app.claim_bootstrap_super_admin(new.id);

  return new;
exception
  when unique_violation then
    -- Operator sudah membuat profil dengan email ini di bawah id lain.
    -- Biarkan; sign-in akan ditolak dan tampak oleh administrator.
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: kalau pemilik email bootstrap terlanjur mendaftar sebelum migrasi
-- ini terpasang, angkat sekarang juga.
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  select p.id into v_id
  from public.profiles p
  join public.app_config c on c.key = 'auth.bootstrap_super_admin_email'
  where lower(trim(p.email)) = lower(trim(c.value #>> '{}'))
    and p.deleted_at is null
  order by p.created_at
  limit 1;

  if v_id is not null then
    perform app.claim_bootstrap_super_admin(v_id);
  end if;
end;
$$;
