"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { signUpWithPassword, type AuthFormState } from "@/server/actions/auth";
import { buttonClass, Field } from "@/components/ui/primitives";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      {pending ? "Mendaftarkan…" : "Daftar"}
      {!pending ? <UserPlus size={16} /> : null}
    </button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signUpWithPassword, {});
  const [showPassword, setShowPassword] = React.useState(false);

  if (state.notice) {
    return (
      <div className="mt-7 rounded-xl border border-success/25 bg-success-soft px-4 py-4 text-sm text-success">
        <p className="font-semibold">Pendaftaran terkirim</p>
        <p className="mt-1.5 text-xs leading-relaxed opacity-90">{state.notice}</p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-7 space-y-4">
      <Field label="Nama Lengkap" htmlFor="fullName" required>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          minLength={3}
          placeholder="Nama sesuai data kepegawaian"
          className="cr-input"
        />
      </Field>

      <Field label="Email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="nama@hotel.com"
          className="cr-input"
        />
      </Field>

      <Field
        label="Kata Sandi"
        htmlFor="password"
        required
        hint="Minimal 10 karakter, memuat huruf besar, huruf kecil, dan angka."
      >
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="••••••••••"
            className="cr-input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint transition hover:text-text"
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>

      <Field label="Ulangi Kata Sandi" htmlFor="confirm" required>
        <input
          id="confirm"
          name="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={10}
          placeholder="••••••••••"
          className="cr-input"
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-xs leading-relaxed text-text-faint">
        Mendaftar hanya membuat identitas Anda. Akses ke modul terbuka setelah Super Admin
        menetapkan peran dan unit hotel.
      </p>
    </form>
  );
}
