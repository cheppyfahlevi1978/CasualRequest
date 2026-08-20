import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Department, Hotel, Profile } from "@/types/domain";

export const ACTIVE_HOTEL_COOKIE = "cr_hotel";

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  roles: string[];
  permissions: string[];
  hotels: Hotel[];
  activeHotel: Hotel | null;
  department: Department | null;
}

/**
 * Loads everything the shell needs about the caller in one pass.
 *
 * `cache()` dedupes this across a single render, so a page and its layout share
 * one round trip (PRD §52).
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) return null;

  // A pending / inactive / suspended account gets identity but no scope, so
  // callers can render Access Denied instead of an empty dashboard (PRD §42).
  if (profile.status !== "active") {
    return {
      userId: user.id,
      email: user.email ?? profile.email,
      profile,
      roles: [],
      permissions: [],
      hotels: [],
      activeHotel: null,
      department: null,
    };
  }

  const [{ data: hotels }, { data: roleRows }, { data: department }] = await Promise.all([
    supabase
      .from("hotels")
      .select(
        "id, code, name, address, city, phone, email, logo_path, timezone, currency, status, latitude, longitude, geofence_radius_m",
      )
      .eq("status", "active")
      .order("name")
      .returns<Hotel[]>(),
    supabase
      .from("user_roles")
      .select("hotel_id, roles!inner(code, role_permissions(permissions(code)))")
      .eq("user_id", user.id),
    profile.department_id
      ? supabase
          .from("departments")
          .select("id, hotel_id, code, name, is_active, sort_order")
          .eq("id", profile.department_id)
          .maybeSingle<Department>()
      : Promise.resolve({ data: null }),
  ]);

  const roles = new Set<string>();
  const permissions = new Set<string>();

  type RoleJoin = {
    roles: {
      code: string;
      role_permissions: { permissions: { code: string } | null }[] | null;
    } | null;
  };

  for (const row of (roleRows ?? []) as unknown as RoleJoin[]) {
    if (!row.roles) continue;
    roles.add(row.roles.code);
    for (const rp of row.roles.role_permissions ?? []) {
      if (rp.permissions?.code) permissions.add(rp.permissions.code);
    }
  }

  const hotelList = hotels ?? [];
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_HOTEL_COOKIE)?.value;

  const activeHotel =
    hotelList.find((h) => h.id === preferred) ??
    hotelList.find((h) => h.id === profile.primary_hotel_id) ??
    hotelList[0] ??
    null;

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    roles: [...roles],
    permissions: [...permissions],
    hotels: hotelList,
    activeHotel,
    department: (department as Department | null) ?? null,
  };
});

/** Redirects to login / access-denied instead of returning an unusable context. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.status !== "active") redirect("/access-denied");
  if (!ctx.activeHotel) redirect("/access-denied?reason=no-hotel");
  return ctx;
}

export function can(ctx: SessionContext, permission: string): boolean {
  return ctx.roles.includes("super_admin") || ctx.permissions.includes(permission);
}

export function canAny(ctx: SessionContext, ...permissions: string[]): boolean {
  return permissions.some((p) => can(ctx, p));
}

/** Server-side gate for a page. Mirrors the RLS policy, never replaces it. */
export async function requirePermission(permission: string): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!can(ctx, permission)) {
    redirect(`/access-denied?reason=permission&need=${encodeURIComponent(permission)}`);
  }
  return ctx;
}
