import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { APPROVAL_STEP_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Help Center" };

const FLOW = [
  {
    title: "1. Buat request",
    body: "HOD atau Supervisor mengisi kebutuhan casual: department, posisi, tanggal, jam kerja, jumlah, dan alasan. Nomor request dibuat otomatis dan tidak pernah duplikat.",
  },
  {
    title: "2. Ajukan approval",
    body: "Saat diajukan, sistem menghitung estimasi biaya (rate × jumlah) lalu memilih jalur approval sesuai ambang biaya yang dikonfigurasi Super Admin.",
  },
  {
    title: "3. Approval berjenjang",
    body: "Setiap tahap mencatat siapa memutuskan, kapan, dan catatannya. Tidak ada approval anonim, dan requester tidak dapat menyetujui pengajuannya sendiri.",
  },
  {
    title: "4. Assignment",
    body: "HR memilih casual dari talent pool. Casual yang berstatus blacklist tidak muncul, dan satu casual tidak bisa terjadwal dua kali pada hari yang sama.",
  },
  {
    title: "5. Absensi",
    body: "Supervisor atau casual mencatat check-in dan check-out. Durasi kerja dan lembur dihitung di server: check-out − check-in − istirahat.",
  },
  {
    title: "6. Evaluasi & pembayaran",
    body: "Setelah penugasan selesai, supervisor menilai 8 kriteria. Finance membuat perhitungan pembayaran dari absensi, memverifikasi, lalu menandai lunas.",
  },
];

const FAQ = [
  {
    q: "Kenapa akun Google saya ditolak padahal login berhasil?",
    a: "Autentikasi dan otorisasi terpisah. Akun Google yang valid tetap perlu profil aktif beserta role dan unit hotel yang ditetapkan HR Admin atau Super Admin.",
  },
  {
    q: "Saya tidak melihat menu tertentu di sidebar.",
    a: "Menu hanya tampil bila role Anda memiliki izin terkait. Menyembunyikan tombol bukan satu-satunya pengaman: server dan database menolak aksi yang tidak berizin walaupun URL diakses langsung.",
  },
  {
    q: "Kenapa request saya tidak bisa diedit lagi?",
    a: "Request hanya dapat diedit selama berstatus Draft atau Dikembalikan. Setelah masuk alur approval, perubahan harus melalui Kembalikan untuk Revisi oleh approver.",
  },
  {
    q: "Bisakah saya menghapus data casual atau request?",
    a: "Tidak. Data penting memakai soft delete dan riwayat penugasan serta pembayaran tetap disimpan. Casual yang tidak dipakai lagi cukup diubah statusnya menjadi Nonaktif.",
  },
  {
    q: "Bagaimana keamanan dokumen KTP dan CV?",
    a: "Berkas disimpan di bucket privat. Tidak ada URL publik permanen; setiap akses menerbitkan signed URL berumur pendek dan tercatat pada activity log.",
  },
  {
    q: "Indikator koneksi merah, apa artinya?",
    a: "Indikator itu memeriksa kesehatan aplikasi (database, auth, storage), bukan sekadar koneksi internet browser. Saat merah, hindari aksi tulis sampai status pulih.",
  },
];

export default async function HelpPage() {
  const ctx = await requireSession();

  return (
    <>
      <PageHeader
        title="Help Center"
        description="Panduan singkat alur kerja Casual Request dan jawaban atas pertanyaan yang sering muncul."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alur kerja Casual Request" />
          <ol className="divide-y divide-border">
            {FLOW.map((f) => (
              <li key={f.title} className="px-5 py-4">
                <p className="text-sm font-semibold text-text">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{f.body}</p>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Akses Anda saat ini" />
            <dl className="space-y-2 p-5 text-sm">
              <Row label="Nama" value={ctx.profile.full_name || ctx.email} />
              <Row label="Email" value={ctx.email} />
              <Row label="Role" value={ctx.roles.join(", ") || "—"} />
              <Row label="Unit hotel aktif" value={ctx.activeHotel?.name ?? "—"} />
              <Row label="Department" value={ctx.department?.name ?? "—"} />
              <Row label="Jumlah izin" value={`${ctx.permissions.length} permission`} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Tahap approval" description="Nama tahap dalam sistem" />
            <ul className="space-y-1.5 p-5 text-xs text-text-muted">
              {Object.entries(APPROVAL_STEP_LABEL).map(([code, label]) => (
                <li key={code} className="flex justify-between gap-3">
                  <span className="font-mono">{code}</span>
                  <span className="text-text">{label}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Butuh bantuan lebih lanjut?" />
            <div className="space-y-2 p-5 text-xs text-text-muted">
              <p>
                Untuk perubahan role, akses unit hotel, atau reset akun, hubungi HR Admin atau
                Super Admin properti Anda.
              </p>
              <p>
                Kendala teknis (halaman error, data tidak muncul) dicatat otomatis pada system log.
                Sertakan waktu kejadian saat melapor agar mudah ditelusuri.
              </p>
              <Link href="/dashboard" className="inline-block font-medium text-primary hover:underline">
                Kembali ke Dashboard
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Pertanyaan yang sering diajukan" />
        <div className="divide-y divide-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-3.5">
              <summary className="cursor-pointer list-none text-sm font-medium text-text marker:hidden">
                {item.q}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-right text-xs text-text">{value}</dd>
    </div>
  );
}
