import type { Metadata } from "next";
import { ResetPasswordForm } from "@/app/reset-password/form";

export const metadata: Metadata = { title: "Atur Ulang Kata Sandi" };

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight text-text">Kata sandi baru</h1>
        <p className="mt-1.5 text-sm text-text-muted">
          Minimal 10 karakter, memuat huruf besar, huruf kecil, dan angka.
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
