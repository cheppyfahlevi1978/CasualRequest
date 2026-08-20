"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword, type AuthFormState } from "@/server/actions/auth";
import { buttonClass, Field } from "@/components/ui/primitives";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      {pending ? "Menyimpan…" : "Simpan kata sandi"}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Kata Sandi Baru" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="cr-input"
        />
      </Field>

      <Field label="Konfirmasi Kata Sandi" htmlFor="confirm" required>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="cr-input"
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
