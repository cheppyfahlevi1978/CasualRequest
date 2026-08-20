"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset, type AuthFormState } from "@/server/actions/auth";
import { buttonClass, Field } from "@/components/ui/primitives";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      {pending ? "Mengirim…" : "Kirim tautan pemulihan"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="nama@hotel.com"
          className="cr-input"
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="rounded-lg border border-success/25 bg-success-soft px-3 py-2 text-xs text-success">
          {state.notice}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
