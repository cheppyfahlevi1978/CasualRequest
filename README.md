# Casual Request

Casual Workforce Management Platform untuk hotel — menghubungkan Department, HR,
Management, Finance, dan Casual Worker dalam satu alur digital: pengajuan,
approval berjenjang, penempatan, absensi, evaluasi, biaya, dan audit trail.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase (PostgreSQL + Auth + Storage + Realtime) · Vercel.

---

## Menjalankan secara lokal

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`, lalu isi minimal:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Aplikasi tetap dapat di-build tanpa Supabase, tetapi halaman login akan
menampilkan peringatan "konfigurasi belum lengkap" sampai variabel di atas diisi.

Langkah lengkap dari nol sampai production ada di **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Build dan jalankan production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify:sql` | Validasi migrasi SQL + cek silang skema vs kode |
| `npm run verify` | Typecheck + lint + SQL + build (dipakai CI) |
| `npm run db:push` | Terapkan migrasi ke project Supabase yang ter-link |
| `npm run db:types` | Regenerasi tipe TypeScript dari skema live |

### `npm run verify:sql`

Tiga lapis pemeriksaan tanpa perlu database:

1. Setiap migrasi diparse dengan **grammar PostgreSQL asli** (libpg_query/WASM).
2. Setiap body **PL/pgSQL** diparse dengan parser PL/pgSQL asli.
3. Setiap tabel, view, kolom, dan RPC yang dipanggil kode TypeScript
   dicocokkan dengan definisi di `supabase/migrations` (lewat AST, bukan daftar
   manual), sehingga salah ketik nama kolom tertangkap sebelum runtime.

---

## Struktur

```
src/
  app/
    (app)/              Halaman di dalam shell (sidebar + topbar)
      dashboard/        KPI, 6 grafik, filter
      requests/         Buat request, daftar, detail + timeline, cetak
      approvals/        Approval inbox berjenjang
      assignments/      Penempatan casual dari talent pool
      attendance/       Check-in / check-out, status kehadiran
      casuals/          Database casual + profil
      talent-pool/      Klasifikasi & blacklist
      evaluations/      Penilaian 8 kriteria
      payments/         Perhitungan & penyelesaian pembayaran
      reports/ analytics/ documents/ users/ settings/ audit-log/ help/
    api/
      health/           GET /api/health (PRD §70)
      export/[type]/    Export CSV mengikuti filter layar
      documents/[id]/   Signed URL berumur pendek untuk berkas privat
    login/ auth/callback/ forgot-password/ reset-password/ access-denied/
  components/           UI kit, shell, chart
  lib/                  Supabase client, session, validasi Zod, format, i18n
  server/actions/       Server Actions (semua mutasi)
supabase/
  migrations/           10 migrasi bernomor
  seed.sql              Data contoh untuk development
scripts/                Pemeriksa SQL yang dipakai `npm run verify:sql`
```

---

## Model keamanan

Pertahanan berlapis, sesuai PRD §63–§67:

1. **Supabase Auth** — Google OAuth dan email/password. Autentikasi berhasil
   *tidak* otomatis memberi akses aplikasi; profil harus aktif dan punya role
   serta unit hotel.
2. **Row Level Security** — aktif di seluruh 28 tabel yang terekspos. Tidak ada
   satu pun kebijakan untuk peran `anon`.
3. **RBAC** — 8 role dan 35 permission di `roles`/`permissions`/`role_permissions`,
   dievaluasi oleh fungsi `SECURITY DEFINER` yang juga dipakai kebijakan RLS.
4. **Transisi kritis di database** — submit, approve/reject, assignment,
   check-in/out, dan posting pembayaran berjalan di fungsi `SECURITY DEFINER`
   yang memeriksa ulang wewenang, urutan tahap, dan larangan menyetujui request
   sendiri. UI tidak bisa melewatinya.
5. **Constraint database** — kuantitas, biaya, keunikan nomor request, satu
   casual satu hari, satu absensi per assignment.
6. **Storage RLS** — KTP, CV, sertifikat, dan surat peringatan berada di bucket
   privat; akses hanya melalui signed URL berumur 2 menit dan tercatat di log.
7. **Audit trail** — `activity_logs` untuk aksi pengguna dan `audit_logs` untuk
   nilai lama → nilai baru pada 15 tabel penting.

Service role key tidak pernah masuk bundle browser dan hanya dipakai untuk
provisioning akun di sisi server.
