import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: branding (PRD §41) */}
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-fg lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.35), transparent 42%)," +
              "radial-gradient(circle at 82% 78%, rgba(127,160,138,0.55), transparent 46%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-base font-bold backdrop-blur">
            CR
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Casual Request</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Satu platform yang menghubungkan Department, HR, Management, Finance, dan Casual
            Worker dalam satu alur kerja digital yang cepat, transparan, aman, dan terlacak.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-white/75">
            {[
              "Pengajuan dan approval casual tanpa WhatsApp",
              "Database casual dan talent pool terpusat",
              "Absensi, perhitungan jam kerja, dan biaya otomatis",
              "Dashboard manpower & budget real-time",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Casual Request — Hospitality Enterprise Edition
        </p>
      </section>

      {/* Right: sign-in form */}
      <section className="flex items-center justify-center bg-bg px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-fg">
              CR
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-text">Selamat datang</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Masuk menggunakan akun kantor Anda untuk melanjutkan.
          </p>

          {!configured ? (
            <div className="mt-6 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
              <p className="font-semibold">Konfigurasi belum lengkap</p>
              <p className="mt-1 text-xs opacity-90">
                Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> pada environment sebelum login dapat
                digunakan.
              </p>
            </div>
          ) : (
            <LoginForm next={params.next} initialError={params.error} />
          )}

          <p className="mt-8 text-center text-xs text-text-faint">
            Butuh akses?{" "}
            <Link href="/help" className="font-medium text-primary hover:underline">
              Hubungi HR / Super Admin
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
