import type { Metadata } from "next";
import Link from "next/link";
import { Marcellus } from "next/font/google";
import "./landing.css";

/**
 * Public landing page (root). Signed-in traffic never reaches this: the
 * middleware sends anyone with a session straight to /dashboard.
 */

const marcellus = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marcellus",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Casual Request — Manajemen Tenaga Casual Hotel",
  description:
    "Satu tempat untuk mengajukan kebutuhan casual, menyetujuinya, menempatkan orang, mencatat kehadiran, dan menutup biayanya — untuk seluruh unit hotel Anda.",
  robots: { index: true, follow: true },
};

const STEPS = [
  {
    n: "I",
    title: "Ajukan",
    body: "Departemen mengisi tanggal kerja, shift, jumlah orang, dan alasan. Nomor request terbit otomatis dan tidak pernah kembar.",
  },
  {
    n: "II",
    title: "Setujui",
    body: "Jalur persetujuan mengikuti nilai biaya. Setiap keputusan menyimpan nama, peran, waktu, dan catatannya.",
  },
  {
    n: "III",
    title: "Tempatkan",
    body: "HR memilih dari talent pool dengan rating dan riwayat yang terlihat. Sisa kebutuhan tampil setiap saat.",
  },
  {
    n: "IV",
    title: "Tutup",
    body: "Kehadiran menjadi jam kerja, jam kerja menjadi nilai bayar, dan Finance menutupnya dengan status lunas.",
  },
];

const FIGURES = [
  { value: "18", label: "Modul aplikasi" },
  { value: "8", label: "Peran pengguna" },
  { value: "2", label: "Bahasa antarmuka" },
  { value: "∞", label: "Unit hotel" },
];

const ROLES = [
  {
    title: "Department Head",
    body: "Mengajukan, memantau, dan menilai casual yang bertugas di departemennya.",
  },
  {
    title: "HR Admin",
    body: "Menempatkan orang, mengelola dokumen, dan menjaga kualitas talent pool.",
  },
  {
    title: "Finance",
    body: "Memverifikasi biaya, menandai pembayaran, dan menjaga sisa budget.",
  },
  {
    title: "General Manager",
    body: "Menyetujui pengajuan bernilai besar dan membaca angka lintas unit.",
  },
  {
    title: "Casual Worker",
    body: "Melihat jadwal tugas, melakukan check-in, dan mengunggah dokumen.",
  },
];

export default function LandingPage() {
  return (
    <main className={`atrium ${marcellus.variable}`}>
      <nav className="atr-nav">
        <div className="atr-wrap atr-nav-in">
          <div className="atr-nleft">
            <a href="#alur">Alur</a>
            <a href="#peran">Peran</a>
            <Link href="/login">Bantuan</Link>
          </div>
          <div className="atr-crest">
            <b>CASUAL REQUEST</b>
            <span>ASTON Pekalongan Syariah</span>
          </div>
          <div className="atr-nright">
            <Link href="/login">Masuk</Link>
            <Link href="/register" className="atr-btn atr-btn-brass">
              Daftar
            </Link>
          </div>
        </div>
      </nav>

      <div className="atr-wrap">
        <header className="atr-hero">
          <p className="atr-kicker">Manajemen tenaga casual hotel</p>
          <h1>
            Ketenangan di lobi dimulai dari <em>daftar nama</em> yang rapi.
          </h1>
          <hr className="atr-brass-rule" />
          <p className="atr-lede">
            Satu tempat untuk mengajukan kebutuhan casual, menyetujuinya, menempatkan orang,
            mencatat kehadiran, dan menutup biayanya — untuk seluruh unit hotel Anda.
          </p>
          <div className="atr-cta">
            <Link href="/register" className="atr-btn atr-btn-brass">
              Daftar akun
            </Link>
            <Link href="/login" className="atr-btn">
              Masuk
            </Link>
          </div>
        </header>
      </div>

      <section id="alur" className="atr-wrap atr-plate-out">
        <div className="atr-plate">
          <div className="atr-plate-h">
            <h2>Empat langkah, satu catatan</h2>
            <span className="atr-kicker">CRQ/APK/2026/08</span>
          </div>
          <div className="atr-cols">
            {STEPS.map((step) => (
              <article key={step.n} className="atr-col">
                <div className="atr-n">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="atr-wrap">
        <section className="atr-figures">
          {FIGURES.map((fig) => (
            <div key={fig.label} className="atr-fig">
              <b>{fig.value}</b>
              <span>{fig.label}</span>
            </div>
          ))}
        </section>
      </div>

      <section id="peran" className="atr-wrap atr-edit">
        <p className="atr-kicker">Untuk siapa</p>
        <h2>Satu alur kerja, dilihat dari kursi masing-masing.</h2>
        <p className="atr-quote">
          “Banquet butuh dua belas orang Sabtu ini.” Kalimat itu tetap sederhana — yang berubah
          adalah ke mana ia pergi setelah diucapkan.
        </p>
        <div className="atr-roles">
          {ROLES.map((role) => (
            <article key={role.title} className="atr-role">
              <h3>{role.title}</h3>
              <p>{role.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="atr-foot">
        <div className="atr-wrap">
          <p className="atr-kicker">Mulai</p>
          <h2>Buat akun Anda hari ini.</h2>
          <p>
            Pendaftaran dengan email dan kata sandi tersedia untuk seluruh staf. Peran dan unit
            hotel ditetapkan Super Admin sebelum akses modul dibuka.
          </p>
          <div className="atr-cta">
            <Link href="/register" className="atr-btn atr-btn-brass">
              Daftar sekarang
            </Link>
            <Link href="/login" className="atr-btn">
              Masuk
            </Link>
          </div>
          <p className="atr-fine">
            Casual Request · ASTON Pekalongan Syariah Hotel &amp; Conference Center
          </p>
        </div>
      </footer>
    </main>
  );
}
