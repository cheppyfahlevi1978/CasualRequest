"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

/**
 * Centralized error surface (PRD §54).
 *
 * The user sees a plain sentence, never a stack trace or a raw TypeError. The
 * technical detail stays in the server logs; `digest` is the correlation key.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[casual-request] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/25 bg-danger-soft text-danger">
          <AlertTriangle size={26} />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-text">
          Halaman ini tidak dapat ditampilkan
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Terjadi kendala saat memuat data. Perubahan Anda tidak hilang — silakan coba lagi. Bila
          berulang, laporkan ke Super Admin dengan menyertakan kode di bawah.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-text-faint">Kode: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className={buttonClass("primary", "md")}>
            Coba lagi
          </button>
          <a href="/dashboard" className={buttonClass("secondary", "md")}>
            Ke Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
