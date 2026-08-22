# Langkah selanjutnya — jalankan sendiri di terminal Anda

Database Supabase sudah selesai dan terverifikasi. Sisa pekerjaan di bawah
butuh login akun Anda sendiri (GitHub, Vercel) sehingga harus dijalankan di
terminal biasa (PowerShell/Terminal), bukan lewat sesi ini.

## 1. Install & login GitHub CLI

```powershell
winget install --id GitHub.cli -e
gh auth login
```

Pilih: GitHub.com → HTTPS → Login with a web browser → ikuti kode yang muncul.

## 2. Buat repo dan push

```powershell
cd "C:\Users\189ITM01\OneDrive\Documents\Casual Request"
gh repo create casual-request --private --source=. --remote=origin --push
```

Ini otomatis membuat repo privat di akun GitHub Anda, menambahkan remote, dan
push branch `main` (2 commit yang sudah ada: v1.0 awal + perbaikan backend
hari ini).

## 3. Login Vercel

```powershell
npx vercel login
```

## 4. Import project & isi environment variables

```powershell
npx vercel link
```

Ikuti prompt untuk menghubungkan ke repo GitHub tadi. Setelah linked, isi
environment variables — bisa lewat dashboard Vercel (Settings → Environment
Variables) atau CLI:

```powershell
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# isi: https://bypkassvytacmlcydwat.supabase.co

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# isi: sb_publishable_vfEIXmD7X1idc0zpvflC8w_nVM1qV0H

npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ambil dari Supabase dashboard → Project Settings → API → service_role key
# (saya sengaja tidak bisa mengambil ini otomatis)

npx vercel env add NEXT_PUBLIC_APP_ENV production
# isi: production
```

Ulangi untuk environment `preview` bila ingin Preview Deployment juga
berfungsi (lihat tabel lengkap di Tahap 6 [DEPLOYMENT.md](DEPLOYMENT.md)).

## 5. Deploy

```powershell
npx vercel --prod
```

## 6. Setelah deploy — beri tahu saya

Begitu langkah 1–5 selesai (atau kalau ada yang error), beri tahu saya dan
saya akan:
- Verifikasi `/api/health` di URL production.
- Bantu setup Google OAuth di Supabase Auth (Tahap 5 DEPLOYMENT.md) — ini
  perlu Google Cloud Console, juga akun Anda.
- Bantu jalankan SQL pembuatan Super Admin pertama (Tahap 7) — cukup beri
  saya UUID user dan email setelah Anda buat user itu di Supabase dashboard
  (Authentication → Users → Add user).
