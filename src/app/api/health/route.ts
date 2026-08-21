import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Check = "ok" | "error" | "missing";

/**
 * GET /api/health — PRD §70.
 *
 * Reports reachability only. It must never leak a key, a DSN, a stack trace,
 * or any row of business data.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, Check> = {
    configuration: isSupabaseConfigured() ? "ok" : "missing",
    database: "missing",
    auth: "missing",
    storage: "missing",
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // health_check() is the one function anon is deliberately granted
    // EXECUTE on (every table grant is revoked from anon in migration 07),
    // so it is the only way this endpoint can prove DB connectivity without
    // either exposing data or reporting "error" on a healthy database.
    const [db, auth, storage] = await Promise.allSettled([
      supabase.rpc("health_check"),
      supabase.auth.getSession(),
      supabase.storage.listBuckets(),
    ]);

    checks.database =
      db.status === "fulfilled" && !db.value.error ? "ok" : "error";
    checks.auth = auth.status === "fulfilled" ? "ok" : "error";
    // listBuckets is rejected for anonymous callers on a locked-down project;
    // reaching the endpoint at all is what we are probing.
    checks.storage = storage.status === "fulfilled" ? "ok" : "error";
  }

  const values = Object.values(checks);
  const status = values.every((v) => v === "ok")
    ? "healthy"
    : values.includes("ok")
      ? "degraded"
      : "error";

  return NextResponse.json(
    {
      status,
      environment: publicEnv.appEnv,
      version: "1.0.0",
      checks,
      latency_ms: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    {
      status: status === "error" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
