import "server-only";

import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

/** Uniform shape every Server Action returns. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Postgres error codes we deliberately surface to the user, because the
 * database is the authority for these rules (PRD §54, §63, §66).
 */
const FRIENDLY_BY_CODE: Record<string, string> = {
  "23505": "Data ini sudah ada. Periksa kembali nomor atau kombinasi yang unik.",
  "23503": "Data terkait tidak ditemukan atau masih dipakai oleh record lain.",
  "23514": "Data tidak memenuhi aturan validasi.",
  "42501": "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  P0002: "Data yang dituju tidak ditemukan.",
};

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function isPgLike(e: unknown): e is PgLikeError {
  return typeof e === "object" && e !== null && ("code" in e || "message" in e);
}

/**
 * Turns any thrown value into a message that is safe to show a user, and
 * records the technical detail in system_logs.
 *
 * Database RAISE messages are intentionally passed through: they are authored
 * by us in migration 06 and are the clearest explanation of a rule violation.
 */
export async function handleError(
  error: unknown,
  context: { module: string; action: string; userId?: string | null },
): Promise<string> {
  const pg = isPgLike(error) ? error : null;
  const raw = pg?.message ?? (error instanceof Error ? error.message : String(error));

  void logSystemError(raw, { ...context, code: pg?.code, details: pg?.details });

  if (pg?.code && FRIENDLY_BY_CODE[pg.code]) {
    // Our own RAISE statements carry a readable sentence; prefer it.
    if (pg.code === "42501" || pg.code === "23514") {
      return raw && raw.length < 200 ? raw : FRIENDLY_BY_CODE[pg.code];
    }
    return FRIENDLY_BY_CODE[pg.code];
  }

  if (raw && raw.length < 200 && !/^[A-Za-z]*Error:/.test(raw) && !raw.includes("undefined")) {
    return raw;
  }

  return "Tidak dapat menyimpan perubahan. Silakan coba lagi.";
}

async function logSystemError(
  message: string,
  context: Record<string, unknown>,
): Promise<void> {
  console.error("[casual-request]", context.module, context.action, message);

  if (!hasAdminClient()) return;
  try {
    const admin = createAdminClient();
    await admin.from("system_logs").insert({
      level: "error",
      source: "server-action",
      message: message.slice(0, 2000),
      context,
      user_id: (context.userId as string | undefined) ?? null,
    });
  } catch {
    // Logging must never mask the original failure.
  }
}
