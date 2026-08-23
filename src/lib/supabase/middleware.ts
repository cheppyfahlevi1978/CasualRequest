import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";

/** Routes reachable without a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/auth",
  "/access-denied",
  "/api/health",
  "/forgot-password",
  "/reset-password",
];

/** Reachable without a session, and pointless once you have one. */
const GUEST_ONLY = new Set(["/", "/login", "/register"]);

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true; // public landing page
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session on every request and keeps unauthenticated
 * traffic out of the application shell (PRD §43).
 *
 * This is a coarse gate only. Real authorization happens in RLS and in the
 * server-side checks around every mutation.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    // Without configuration nothing can be authenticated; let the page render
    // its own "configuration missing" state instead of redirect-looping.
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase Auth; getSession() would
  // trust cookie contents, which must not be relied on server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  if (user && GUEST_ONLY.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
