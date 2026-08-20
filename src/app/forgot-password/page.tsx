import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/app/forgot-password/form";

export const metadata: Metadata = { title: "Lupa Kata Sandi" };

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight text-text">Pemulihan akun</h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Masukkan email kantor Anda. Bila terdaftar, kami kirimkan tautan pemulihan yang berlaku
          terbatas.
        </p>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-xs text-text-faint">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
