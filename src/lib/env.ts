/**
 * Environment access in one place.
 *
 * Anything read here that is *not* prefixed with NEXT_PUBLIC_ must only ever be
 * touched from server code (PRD §63, §68). The server-only getters throw when
 * called in the browser rather than silently returning undefined.
 */

function requirePublic(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return requirePublic("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return requirePublic("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get appEnv() {
    return (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as
      | "development"
      | "preview"
      | "production";
  },
};

function serverOnly(name: string): string | undefined {
  if (typeof window !== "undefined") {
    throw new Error(`${name} must never be read in the browser.`);
  }
  return process.env[name];
}

export const serverEnv = {
  get serviceRoleKey() {
    return serverOnly("SUPABASE_SERVICE_ROLE_KEY");
  },
  get allowedEmailDomains(): string[] {
    return (serverOnly("ALLOWED_EMAIL_DOMAINS") ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  },
  get emailApiKey() {
    return serverOnly("EMAIL_API_KEY");
  },
  get emailFrom() {
    return serverOnly("EMAIL_FROM") ?? "Casual Request <no-reply@example.com>";
  },
  get cronSecret() {
    return serverOnly("CRON_SECRET");
  },
};

/** True when the config needed to talk to Supabase at all is present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
