-- =============================================================================
-- Casual Request — Unit pertama: ASTON Pekalongan Syariah
-- =============================================================================
-- Hanya baris hotel yang dibuat di sini.
--
-- Departemen, shift, rate default, aturan approval (PRD §13), dan setting unit
-- dibuat otomatis oleh public.bootstrap_hotel_defaults(), yang dipanggil trigger
-- app.after_hotel_insert() begitu hotel tersimpan (lihat migrasi
-- 20260820001000_reference_data.sql). Menuliskannya ulang di sini justru
-- menghasilkan data ganda dengan kode berbeda.
--
-- Idempotent: aman dijalankan ulang pada environment mana pun.
-- =============================================================================

insert into public.hotels (
  code, name, legal_name, address, city, phone, email,
  timezone, currency, locale, status
)
values (
  'APK',
  'ASTON Pekalongan Syariah Hotel & Conference Center',
  'ASTON Pekalongan Syariah Hotel & Conference Center',
  'Jl. Gajah Mada No. 2, Pekalongan, Jawa Tengah',
  'Pekalongan',
  '+62 285 4416888',
  'info@astonpekalongan.com',
  'Asia/Jakarta',
  'IDR',
  'id',
  'active'
)
on conflict do nothing;
