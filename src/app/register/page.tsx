import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/app/register/register-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Daftar" };

const STEPS = [
  "Buat akun dengan email kantor dan kata sandi Anda",
  "Verifikasi email melalui tautan yang kami kirim",
  "Super Admin menetapkan peran dan unit hotel Anda",
  "Modul terbuka sesuai peran tersebut",
];

export default function RegisterPage() {
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
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Daftar akun</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Pendaftaran terbuka untuk seluruh staf hotel. Akun baru dibuat dalam status menunggu,
            lalu diaktifkan oleh Super Admin sesuai peran dan unit hotel Anda.
          </p>
          <ol className="mt-8 space-y-3 text-sm text-white/75">
            {STEPS.map((line, i) => (
              <li key={line} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-semibold">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Casual Request — Hospitality Enterprise Edition
        </p>
      </section>

      {/* Right: registration form */}
      <section className="flex items-center justify-center bg-bg px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-fg">
              CR
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-text">Buat akun</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>

          {!configured ? (
            <div className="mt-6 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
              <p className="font-semibold">Konfigurasi belum lengkap</p>
              <p className="mt-1 text-xs opacity-90">
                Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> pada environment sebelum pendaftaran
                dapat digunakan.
              </p>
            </div>
          ) : (
            <RegisterForm />
          )}

          <p className="mt-8 text-center text-xs text-text-faint">
            Ada kendala?{" "}
            <Link href="/help" className="font-medium text-primary hover:underline">
              Hubungi HR / Super Admin
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
