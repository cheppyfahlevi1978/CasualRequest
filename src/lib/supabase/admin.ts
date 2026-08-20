import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Privileged client. Bypasses RLS, so it is restricted to the operations the
 * PRD explicitly calls out as privileged server-side flows (PRD §40, §49, §65):
 * user provisioning, signed URLs for privileged exports, and retention deletes.
 *
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const key = serverEnv.serviceRoleKey;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. This operation requires a privileged server key.",
    );
  }

  return createSupabaseClient(publicEnv.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasAdminClient(): boolean {
  return Boolean(serverEnv.serviceRoleKey);
}
