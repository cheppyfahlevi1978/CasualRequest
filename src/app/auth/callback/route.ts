import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

/**
 * OAuth / recovery landing route.
 *
 * A successful Supabase authentication is not, by itself, access to the
 * application: the profile must exist, be active, and pass the domain policy
 * (PRD §42). Anything else is signed straight back out.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError.slice(0, 160))}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Kode otorisasi tidak ditemukan.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Sesi tidak dapat dibuat. Silakan coba lagi.")}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sesi tidak valid.")}`);
  }

  const email = (user.email ?? "").toLowerCase();
  const allowed = serverEnv.allowedEmailDomains;
  if (allowed.length > 0 && !allowed.some((d) => email.endsWith(`@${d}`))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/access-denied?reason=domain`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle<{ status: string }>();

  if (!profile || profile.status !== "active") {
    // Keep the session so /access-denied can name the account, but grant nothing:
    // every RLS policy already gates on an active profile.
    return NextResponse.redirect(`${origin}/access-denied?reason=inactive`);
  }

  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "LOGIN",
    module: "auth",
    description: "User signed in",
  });

  const target = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${target}`);
}
