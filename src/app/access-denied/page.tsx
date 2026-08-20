import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/server/actions/auth";
import { buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Akses Ditolak" };

const REASONS: Record<string, { title: string; body: string }> = {
  inactive: {
    title: "Akun belum diaktifkan",
    body:
      "Akun Anda berhasil terautentikasi, tetapi belum diaktifkan pada aplikasi Casual Request. " +
      "Hubungi HR Admin atau Super Admin untuk mengaktifkan profil dan menetapkan role serta unit hotel.",
  },
  domain: {
    title: "Domain email tidak diizinkan",
    body:
      "Hanya akun dengan domain email perusahaan yang diizinkan mengakses aplikasi ini. " +
      "Gunakan akun kantor Anda, atau hubungi Super Admin bila domain Anda seharusnya diizinkan.",
  },
  "no-hotel": {
    title: "Belum ada unit hotel",
    body:
      "Profil Anda aktif, tetapi belum dipetakan ke unit hotel mana pun. " +
      "HR Admin perlu menambahkan Anda ke minimal satu unit hotel sebelum aplikasi dapat digunakan.",
  },
  permission: {
    title: "Izin tidak mencukupi",
    body:
      "Role Anda tidak memiliki izin untuk membuka halaman ini. " +
      "Bila ini keliru, minta Super Admin meninjau pemetaan role dan permission Anda.",
  },
};

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; need?: string }>;
}) {
  const { reason, need } = await searchParams;
  const info = REASONS[reason ?? "inactive"] ?? REASONS.inactive;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/25 bg-danger-soft text-danger">
          <ShieldAlert size={26} />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">{info.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{info.body}</p>

        {need ? (
          <p className="mt-3 text-xs text-text-faint">
            Izin yang dibutuhkan: <code className="font-mono">{need}</code>
          </p>
        ) : null}

        {user?.email ? (
          <p className="mt-5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-text-muted">
            Masuk sebagai <strong className="text-text">{user.email}</strong>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <form action={signOut}>
            <button type="submit" className={buttonClass("primary", "md")}>
              Keluar dan ganti akun
            </button>
          </form>
          <a href="/help" className={buttonClass("secondary", "md")}>
            Help Center
          </a>
        </div>
      </div>
    </main>
  );
}
