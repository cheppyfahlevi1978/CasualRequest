import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { visibleNav } from "@/lib/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { publicEnv } from "@/lib/env";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  general_manager: "General Manager",
  finance: "Finance",
  hod: "Department Head",
  supervisor: "Supervisor",
  viewer: "Viewer",
  casual_worker: "Casual Worker",
};

const ROLE_ORDER = [
  "super_admin",
  "hr_admin",
  "general_manager",
  "finance",
  "hod",
  "supervisor",
  "viewer",
  "casual_worker",
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession();
  const store = await cookies();

  const primaryRole =
    ROLE_ORDER.find((r) => ctx.roles.includes(r)) ?? ctx.roles[0] ?? "viewer";

  const theme =
    (store.get("cr_theme")?.value as "light" | "dark" | "system" | undefined) ??
    ctx.profile.theme;
  const locale = store.get("cr_locale")?.value === "en" ? "en" : ctx.profile.locale;

  return (
    <AppShell
      nav={visibleNav(ctx)}
      user={{
        name: ctx.profile.full_name || ctx.email,
        email: ctx.email,
        roleLabel: ROLE_LABEL[primaryRole] ?? primaryRole,
        avatarUrl: null,
      }}
      hotels={ctx.hotels.map((h) => ({ id: h.id, code: h.code, name: h.name }))}
      activeHotelId={ctx.activeHotel?.id ?? ""}
      locale={locale}
      theme={theme}
      appEnv={publicEnv.appEnv}
      defaultCollapsed={store.get("cr_sidebar")?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}
