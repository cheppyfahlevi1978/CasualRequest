"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { signInWithGoogle, signInWithPassword, type AuthFormState } from "@/server/actions/auth";
import { buttonClass, Field } from "@/components/ui/primitives";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      {pending ? "Memproses…" : label}
      {!pending ? <LogIn size={16} /> : null}
    </button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("secondary", "md", "w-full")}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.87Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
        />
      </svg>
      {pending ? "Mengalihkan…" : "Masuk dengan Google"}
    </button>
  );
}

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [state, action] = useActionState<AuthFormState, FormData>(signInWithPassword, {
    error: initialError,
  });
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="mt-7 space-y-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <GoogleButton />
      </form>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-text-faint">
        <span className="h-px flex-1 bg-border" />
        atau
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />

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

        <Field label="Kata Sandi" htmlFor="password" required>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="••••••••"
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

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <SubmitButton label="Masuk" />
      </form>

      <div className="text-center">
        <Link href="/forgot-password" className="text-xs text-text-muted hover:text-primary">
          Lupa kata sandi?
        </Link>
      </div>
    </div>
  );
}
