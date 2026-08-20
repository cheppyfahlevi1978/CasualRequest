"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let instance: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client. Only ever carries the publishable key. */
export function createClient() {
  if (!instance) {
    instance = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return instance;
}
