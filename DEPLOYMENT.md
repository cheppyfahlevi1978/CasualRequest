# Deployment — dari nol sampai production

Panduan berurutan. Setiap tahap punya cara verifikasi sendiri; jangan lanjut ke
tahap berikutnya sebelum verifikasinya lulus.

Perkiraan waktu bila semua akun sudah tersedia: **60–90 menit**.

---

## Tahap 0 — Prasyarat

| Kebutuhan | Keterangan |
| --- | --- |
| Node.js ≥ 20.9 | `node -v` |
| Akun GitHub | untuk repository dan CI |
| Akun Supabase | 1 organisasi, 2 project (staging + production) |
| Akun Vercel | terhubung ke GitHub |
| Supabase CLI | `npm i -g supabase` atau `npx supabase` |
| Domain perusahaan | opsional, untuk custom domain |

> **Catatan biaya.** Free tier Supabase mem-pause project yang menganggur dan
> tidak menyediakan Point-in-Time Recovery. Untuk production yang dipakai
> operasional hotel, gunakan plan berbayar (lihat Tahap 9).

---

## Tahap 1 — Repository

```bash
cd "Casual Request"
git init -b main
git add .
git commit -m "Casual Request v1.0"
```

Buat repository privat di GitHub, lalu:

```bash
git remote add origin https://github.com/<org>/casual-request.git
git push -u origin main
```

**Verifikasi:** `git status` bersih, dan `.env.local` **tidak** ikut ter-commit
(sudah diabaikan lewat `.gitignore`).

---

## Tahap 2 — Project Supabase

Buat **dua** project di region terdekat (`ap-southeast-1` / Singapore untuk
Indonesia):

- `casual-request-staging` — dipakai Preview Deployment
- `casual-request-prod` — dipakai Production

Untuk masing-masing, catat dari **Project Settings → API**:

- Project URL — `https://<ref>.supabase.co`
- Publishable key (`sb_publishable_…`) atau legacy anon key
- Service role key (**server-only**, jangan pernah dibagikan ke browser)

Dan dari **Project Settings → Database**: password database.

> Jangan menempelkan skema Casual Request ke project yang sudah dipakai
> aplikasi lain. Skema ini memiliki `public.profiles` sendiri dan trigger pada
> `auth.users`; menumpuknya di atas aplikasi lain akan merusak keduanya.

---

## Tahap 3 — Terapkan migrasi

Sebelum menyentuh cloud, pastikan SQL-nya sehat:

```bash
npm run verify:sql
```

Lalu, per environment (mulai dari staging):

```bash
supabase login
supabase link --project-ref <ref-staging>
supabase db push
```

Urutan yang dijalankan:

| Migrasi | Isi |
| --- | --- |
| `…0100_extensions_and_types` | extension, schema `app`, 15 enum |
| `…0200_core_tables` | hotel, department, profil, RBAC, shift, rate, threshold, budget |
| `…0300_operational_tables` | casual, request, approval, assignment, absensi, evaluasi, payment, dokumen, notifikasi, log |
| `…0400_auth_helpers` | fungsi otorisasi `SECURITY DEFINER` |
| `…0500_triggers` | timestamp, audit, generator Request ID / Casual ID, hitung jam kerja, rollup rating |
| `…0600_business_functions` | submit, approve/reject, assignment, check-in/out, payment |
| `…0700_rls_policies` | RLS di 28 tabel + guard eskalasi hak akses |
| `…0800_storage` | 4 bucket + policy `storage.objects` |
| `…0900_views_and_reporting` | 3 view + RPC dashboard & analytics |
| `…1000_reference_data` | 8 role, 35 permission, bootstrap default per hotel |

**Verifikasi:**

```bash
supabase migration list --linked
```

Lalu di dashboard Supabase → **Advisors → Security**: tidak boleh ada temuan
"RLS disabled in public".

---

## Tahap 4 — Storage

Migrasi `…0800_storage` sudah membuat bucket dan policy-nya:

| Bucket | Publik | Isi |
| --- | --- | --- |
| `casual-request-private` | tidak | KTP, CV, sertifikat, perjanjian, bukti absensi |
| `profile-images` | tidak | foto profil staf |
| `hotel-assets` | ya | logo dan foto hotel |
| `report-exports` | tidak | hasil export yang dibuat server |

Konvensi path: `{kode_hotel}/{entitas}/{id}/{jenis}/{berkas}` — segmen pertama
dipakai policy untuk menentukan hotel pemilik objek.

**Verifikasi:** buka **Storage** di dashboard, keempat bucket ada, dan
`casual-request-private` berlabel *Private*.

---

## Tahap 5 — Authentication

**Authentication → Providers → Google**

1. Di Google Cloud Console buat OAuth Client (Web application).
2. Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
3. Tempel Client ID dan Client Secret ke Supabase.

**Authentication → URL Configuration**

- Site URL: `https://casualrequest.<domain-perusahaan>`
- Redirect URLs: tambahkan
  - `https://casualrequest.<domain-perusahaan>/auth/callback`
  - `https://*.vercel.app/auth/callback` (untuk Preview)
  - `http://localhost:3000/auth/callback` (untuk development)

**Authentication → Sign In / Providers**

- **Matikan** "Allow new users to sign up". Pengguna disediakan oleh
  administrator; akun Google yang tidak terdaftar akan sampai ke halaman
  *Access Denied*, bukan ke dashboard.

Untuk membatasi domain email perusahaan, isi `ALLOWED_EMAIL_DOMAINS` di Vercel
(Tahap 6), misal `astonhotels.com`.

---

## Tahap 6 — Vercel

1. **Add New → Project** → import repository GitHub tadi.
2. Framework terdeteksi otomatis sebagai Next.js. Biarkan build command default.
3. **Settings → Environment Variables**, isi terpisah per environment:

| Variabel | Production | Preview | Development | Server-only |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | staging | staging | tidak |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | staging | staging | tidak |
| `NEXT_PUBLIC_APP_URL` | domain production | biarkan kosong | `http://localhost:3000` | tidak |
| `NEXT_PUBLIC_APP_ENV` | `production` | `preview` | `development` | tidak |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` hanya setelah provider Google aktif | idem | `false` | tidak |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | staging | staging | **ya** |
| `ALLOWED_EMAIL_DOMAINS` | domain perusahaan | idem | kosong | ya |
| `EMAIL_API_KEY`, `EMAIL_FROM` | opsional | opsional | opsional | ya |
| `CRON_SECRET` | string acak | string acak | — | ya |

`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` sengaja default `false`. Selama provider
Google belum dikonfigurasi di Supabase Auth, tombol "Masuk dengan Google"
disembunyikan dan server action-nya menolak, sehingga login email + kata sandi
menjadi satu-satunya jalur yang ditawarkan.

Aturan yang tidak boleh dilanggar:

- Rahasia **tidak pernah** memakai prefiks `NEXT_PUBLIC_`.
- Rahasia production dan preview **berbeda**.
- Tidak ada rahasia yang di-commit ke repository.

4. Deploy.

**Verifikasi:** buka `https://<deployment>/api/health` — harus mengembalikan
`{"status":"healthy", …}` tanpa satu pun kunci atau stack trace di dalamnya.

---

## Tahap 7 — Super Admin pertama

Ini satu-satunya langkah yang dikerjakan manual, karena aplikasi memerlukan
seorang administrator sebelum bisa mengelola dirinya sendiri.

1. **Supabase → Authentication → Users → Add user**: masukkan email Anda,
   centang *Auto Confirm User*. Salin UUID yang terbentuk.
2. **SQL Editor**, jalankan (ganti kedua nilai di baris pertama):

```sql
do $$
declare
  v_user_id uuid := '<uuid-dari-langkah-1>';
  v_email   text := '<email-anda>';
  v_hotel   uuid;
begin
  insert into public.hotels (code, name, city, timezone, currency)
  values ('APK', 'ASTON Pekalongan Syariah Hotel & Conference Center',
          'Pekalongan', 'Asia/Jakarta', 'IDR')
  on conflict do nothing;

  select id into v_hotel from public.hotels where code = 'APK';

  insert into public.profiles (id, email, full_name, status, primary_hotel_id)
  values (v_user_id, v_email, 'Super Admin', 'active', v_hotel)
  on conflict (id) do update
    set status = 'active', primary_hotel_id = excluded.primary_hotel_id;

  insert into public.user_roles (user_id, role_id, hotel_id)
  select v_user_id, r.id, null from public.roles r where r.code = 'super_admin'
  on conflict do nothing;

  insert into public.user_hotels (user_id, hotel_id, is_default)
  values (v_user_id, v_hotel, true)
  on conflict do nothing;
end $$;
```

Department, shift, rate, threshold approval, dan pengaturan absensi dibuat
otomatis oleh trigger saat hotel dibuat.

3. Buka aplikasi, login, lalu **Pengaturan** untuk menyesuaikan rate dan
   ambang approval, dan **Add User** untuk membuat HR Admin, GM, Finance, HOD,
   dan Supervisor.

**Verifikasi:** sidebar menampilkan seluruh 18 menu, dan
**Audit Log → Aktivitas** memuat baris `LOGIN` atas nama Anda.

---

## Tahap 8 — Custom domain

**Vercel → Settings → Domains** → tambahkan `casualrequest.<domain-perusahaan>`,
ikuti instruksi DNS. HTTPS diterbitkan otomatis.

Setelah domain aktif, perbarui:

- `NEXT_PUBLIC_APP_URL` di Vercel Production
- Site URL dan Redirect URLs di Supabase Auth

lalu redeploy.

---

## Tahap 9 — Backup dan pemulihan

**Database**

- Free tier: backup harian, retensi terbatas, tanpa PITR.
- Pro dan di atasnya: aktifkan **Point-in-Time Recovery**.
- Uji restore ke project terpisah minimal sekali per kuartal, dan catat
  waktu yang dibutuhkan.

**Storage**

Backup PostgreSQL **tidak** mencakup objek di Storage. Dokumen KTP, CV, dan
sertifikat memerlukan strategi terpisah — jadwalkan replikasi/eksport objek
`casual-request-private` ke penyimpanan lain sesuai kebijakan retensi
perusahaan.

**Skenario yang wajib terdokumentasi**

| Skenario | Tindakan |
| --- | --- |
| Deployment gagal | Vercel → Deployments → *Promote to Production* pada deployment sebelumnya. Skema database tidak ikut mundur. |
| Migrasi rusak | Tulis migrasi perbaikan maju (forward fix); jangan mengedit migrasi yang sudah diterapkan. |
| Data terhapus tidak sengaja | Data penting memakai soft delete (`deleted_at`); pulihkan dengan mengosongkan kolom itu. Bila hard delete, gunakan PITR. |
| Objek Storage hilang | Pulihkan dari backup objek terpisah. |
| Kredensial bocor | Rotasi kunci di Supabase, perbarui di Vercel, redeploy, lalu telusuri `audit_logs` dan `activity_logs`. |
| Kehilangan project Supabase | Buat project baru, `supabase db push`, restore backup, hubungkan ulang env di Vercel. |

---

## Tahap 10 — Operasional berjalan

**Alur perubahan**

1. Buat branch, kerjakan perubahan, buka Pull Request.
2. CI menjalankan typecheck, lint, verifikasi SQL, dan build.
3. Vercel membuat Preview Deployment yang menunjuk ke Supabase staging.
4. Review perubahan migrasi secara terpisah dari perubahan kode.
5. Merge ke `main` → workflow `deploy-migrations.yml` menerapkan migrasi ke
   production (dengan approval reviewer), Vercel deploy production, lalu
   health check dijalankan.

**Secret GitHub yang perlu diisi** (Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN` — personal access token Supabase
- `SUPABASE_PROJECT_REF` — ref project production
- `SUPABASE_DB_PASSWORD` — password database production
- `PRODUCTION_URL` — mis. `https://casualrequest.<domain-perusahaan>`

Buat juga GitHub Environment bernama `production` dengan *required reviewers*,
agar tidak ada perubahan skema production yang lolos tanpa persetujuan manusia.

**Yang perlu dipantau**

- Vercel: build error dan function error
- Supabase: Logs, Advisors (Security dan Performance), slow query
- Aplikasi: tabel `system_logs` untuk kegagalan sisi server
- Indikator koneksi di topbar: memeriksa database, auth, dan storage — bukan
  sekadar koneksi internet browser

---

## Lampiran — daftar periksa sebelum go-live

- [ ] `npm run verify` lulus di lokal dan di CI
- [ ] Advisor keamanan Supabase bersih dari temuan RLS
- [ ] Google OAuth berhasil, dan akun tidak terdaftar mendapat *Access Denied*
- [ ] Sign-up mandiri dimatikan di Supabase Auth
- [ ] `SUPABASE_SERVICE_ROLE_KEY` hanya ada di environment server
- [ ] Rate casual, ambang approval, dan budget bulan berjalan sudah diisi
- [ ] Uji satu siklus penuh: request → approval → assignment → absensi →
      evaluasi → pembayaran → tutup request
- [ ] Export CSV berfungsi dan mengikuti filter
- [ ] Dokumen privat hanya terbuka lewat signed URL, dan aksesnya tercatat
- [ ] Prosedur restore sudah diuji, bukan hanya didokumentasikan
- [ ] Custom domain aktif dengan HTTPS
