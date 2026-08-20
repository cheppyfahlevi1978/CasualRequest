"use client";

import * as React from "react";

type Health = "healthy" | "degraded" | "error" | "checking";

const DOT: Record<Health, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  error: "bg-danger",
  checking: "bg-text-faint",
};

/**
 * Application health, not browser connectivity (PRD §55).
 *
 * Polls /api/health, which probes the database, auth and storage. On failure
 * the app degrades rather than blanking out.
 */
export function ConnectionStatus({ locale }: { locale: "id" | "en" }) {
  const [status, setStatus] = React.useState<Health>("checking");
  const [detail, setDetail] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;

    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as {
          status?: Health;
          checks?: Record<string, string>;
        };
        if (cancelled) return;
        failures = 0;
        setStatus(body.status === "healthy" ? "healthy" : body.status ?? "degraded");
        setDetail(
          Object.entries(body.checks ?? {})
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n"),
        );
      } catch {
        if (cancelled) return;
        failures += 1;
        setStatus(failures >= 2 ? "error" : "degraded");
        setDetail("");
      } finally {
        if (!cancelled) {
          // Back off while unhealthy instead of hammering a struggling backend.
          timer = window.setTimeout(check, failures > 0 ? 30_000 : 60_000);
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const label =
    status === "healthy"
      ? locale === "id"
        ? "Terhubung"
        : "Connected"
      : status === "checking"
        ? locale === "id"
          ? "Memeriksa"
          : "Checking"
        : status === "degraded"
          ? locale === "id"
            ? "Terganggu"
            : "Degraded"
          : locale === "id"
            ? "Terputus"
            : "Disconnected";

  return (
    <span
      className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-text-muted md:inline-flex"
      title={detail || label}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
      {label}
    </span>
  );
}
