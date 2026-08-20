"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/errors";

/** Every settings action reports success with no payload. */
type AnyAction = (
  prev: ActionResult<null> | undefined,
  formData: FormData,
) => Promise<ActionResult<null>>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

/**
 * Thin client wrapper so a Server Component can render a form backed by a
 * Server Action and still get toast feedback and a refresh on success.
 */
export function ActionForm({
  action,
  submitLabel = "Simpan",
  successTitle = "Tersimpan",
  children,
  className,
  onDone,
}: {
  // Server Actions are passed across the boundary as opaque references.
  action: AnyAction;
  submitLabel?: string;
  successTitle?: string;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, dispatch] = useActionState<ActionResult<null> | undefined, FormData>(
    action,
    undefined,
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(successTitle, state.message);
      router.refresh();
      onDone?.();
    } else {
      toast.error("Gagal", state.error);
    }
    // onDone is intentionally excluded: callers pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast, router, successTitle]);

  return (
    <form action={dispatch} className={className}>
      {children}
      {state && !state.ok ? (
        <p className="mt-3 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
