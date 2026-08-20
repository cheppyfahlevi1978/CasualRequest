"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  CheckSquare,
  UserCheck,
  ClipboardCheck,
  Users,
  Star,
  ClipboardList,
  Wallet,
  FileBarChart,
  TrendingUp,
  FolderOpen,
  UserPlus,
  Settings,
  ScrollText,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Moon,
  Building2,
  ChevronDown,
  Languages,
} from "lucide-react";
import { NAV_GROUP_LABEL, type NavItem } from "@/lib/nav-items";
import { cn } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/modal";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { NotificationBell } from "@/components/layout/notification-bell";
import { setActiveHotel, setLocale, setTheme, signOut } from "@/server/actions/auth";

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  FilePlus2,
  FileText,
  CheckSquare,
  UserCheck,
  ClipboardCheck,
  Users,
  Star,
  ClipboardList,
  Wallet,
  FileBarChart,
  TrendingUp,
  FolderOpen,
  UserPlus,
  Settings,
  ScrollText,
  LifeBuoy,
};

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
  avatarUrl: string | null;
}

export interface ShellHotel {
  id: string;
  code: string;
  name: string;
}

export function AppShell({
  nav,
  user,
  hotels,
  activeHotelId,
  locale,
  theme,
  appEnv,
  defaultCollapsed,
  children,
}: {
  nav: NavItem[];
  user: ShellUser;
  hotels: ShellHotel[];
  activeHotelId: string;
  locale: "id" | "en";
  theme: "light" | "dark" | "system";
  appEnv: string;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Seeded from a cookie the server already read, so the sidebar renders in the
  // right state on first paint instead of snapping after hydration.
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `cr_sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };

  const groups = React.useMemo(() => {
    const order: NavItem["group"][] = ["main", "operations", "insight", "admin"];
    return order
      .map((g) => ({ group: g, items: nav.filter((n) => n.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [nav]);

  const isActive = (item: NavItem) => {
    if (item.match) {
      // "/requests" must not light up while on "/requests/new".
      if (item.href === "/requests" && pathname.startsWith("/requests/new")) return false;
      return pathname === item.match || pathname.startsWith(`${item.match}/`);
    }
    return pathname === item.href;
  };

  const navBody = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map(({ group, items }) => (
        <div key={group}>
          {!collapsed ? (
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-text-faint">
              {NAV_GROUP_LABEL[group][locale]}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon] ?? FileText;
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? (locale === "id" ? item.label : item.labelEn) : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-primary-soft font-semibold text-primary"
                        : "text-text-muted hover:bg-bg-subtle hover:text-text",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed ? (
                      <span className="truncate">
                        {locale === "id" ? item.label : item.labelEn}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
        CR
      </span>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-text">Casual Request</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-text-faint">
            {appEnv}
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.25rem]" : "w-64",
        )}
      >
        {brand}
        {navBody}
        <div className="shrink-0 border-t border-border p-3">
          <form action={signOut}>
            <button
              type="submit"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-text-muted transition hover:bg-danger-soft hover:text-danger",
                collapsed && "justify-center px-0",
              )}
            >
              <LogOut size={17} className="shrink-0" />
              {!collapsed ? <span>{locale === "id" ? "Keluar" : "Sign out"}</span> : null}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu">
        {brand}
        {navBody}
        <div className="shrink-0 border-t border-border p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-text-muted transition hover:bg-danger-soft hover:text-danger"
            >
              <LogOut size={17} />
              <span>{locale === "id" ? "Keluar" : "Sign out"}</span>
            </button>
          </form>
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle lg:hidden"
            aria-label="Buka menu"
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle lg:block"
            aria-label="Perkecil sidebar"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <HotelSelector hotels={hotels} activeHotelId={activeHotelId} />

          <form
            className="ml-auto hidden max-w-xs flex-1 items-center sm:flex"
            action="/search"
            method="get"
          >
            <div className="relative w-full">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
              />
              <input
                type="search"
                name="q"
                placeholder={locale === "id" ? "Cari request, casual…" : "Search…"}
                className="cr-input h-9 pl-9 text-xs"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:ml-2">
            <ConnectionStatus locale={locale} />
            <NotificationBell locale={locale} />
            <button
              type="button"
              onClick={() => {
                const next = locale === "id" ? "en" : "id";
                void setLocale(next).then(() => router.refresh());
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-text-muted transition hover:bg-bg-subtle hover:text-text"
              title="Bahasa / Language"
            >
              <Languages size={16} />
              <span className="uppercase">{locale}</span>
            </button>
            <ThemeToggle theme={theme} />
            <UserMenu user={user} locale={locale} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="no-print border-t border-border px-4 py-3 text-center text-[11px] text-text-faint sm:px-6">
          Casual Request v1.0 — Casual Workforce Management Platform
        </footer>
      </div>
    </div>
  );
}

function HotelSelector({
  hotels,
  activeHotelId,
}: {
  hotels: ShellHotel[];
  activeHotelId: string;
}) {
  const router = useRouter();
  const active = hotels.find((h) => h.id === activeHotelId) ?? hotels[0];

  if (!active) return null;

  if (hotels.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-text-muted">
        <Building2 size={15} />
        <span className="max-w-[10rem] truncate sm:max-w-[18rem]">{active.name}</span>
      </div>
    );
  }

  return (
    <label className="relative flex items-center">
      <Building2
        size={15}
        className="pointer-events-none absolute left-2.5 text-text-faint"
      />
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 text-text-faint"
      />
      <span className="sr-only">Unit hotel</span>
      <select
        value={active.id}
        onChange={(e) => {
          void setActiveHotel(e.target.value).then(() => router.refresh());
        }}
        className="h-9 max-w-[11rem] appearance-none rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-text sm:max-w-[16rem]"
      >
        {hotels.map((h) => (
          <option key={h.id} value={h.id}>
            {h.code} — {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThemeToggle({ theme }: { theme: "light" | "dark" | "system" }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState(theme);

  const apply = (next: "light" | "dark" | "system") => {
    setCurrent(next);
    const root = document.documentElement;
    const dark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    void setTheme(next).then(() => router.refresh());
  };

  const isDark =
    current === "dark" ||
    (current === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <button
      type="button"
      onClick={() => apply(isDark ? "light" : "dark")}
      className="rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle hover:text-text"
      title={isDark ? "Mode terang" : "Mode gelap"}
      aria-label="Ganti tema"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function UserMenu({ user, locale }: { user: ShellUser; locale: "id" | "en" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const label = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-bg-subtle"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-primary-soft text-xs font-semibold text-primary">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            label || "?"
          )}
        </span>
        <ChevronDown size={14} className="hidden text-text-faint sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-text">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
              {user.roleLabel}
            </p>
          </div>
          <Link
            href="/profile"
            className="block px-4 py-2.5 text-sm text-text-muted transition hover:bg-bg-subtle hover:text-text"
          >
            {locale === "id" ? "Profil Saya" : "My Profile"}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-sm text-danger transition hover:bg-danger-soft"
            >
              {locale === "id" ? "Keluar" : "Sign out"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
