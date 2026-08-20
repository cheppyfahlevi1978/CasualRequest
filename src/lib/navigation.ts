import type { SessionContext } from "@/lib/auth/session";
import { can, canAny } from "@/lib/auth/session";
import type { NavItem } from "@/lib/nav-items";

export type { NavItem };

interface NavDefinition extends NavItem {
  visible: (ctx: SessionContext) => boolean;
}

/** PRD §6 sidebar, in order, each gated by the permission behind the page. */
const DEFINITIONS: NavDefinition[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    labelEn: "Dashboard",
    icon: "LayoutDashboard",
    group: "main",
    visible: () => true,
  },
  {
    href: "/requests/new",
    label: "Buat Request",
    labelEn: "New Request",
    icon: "FilePlus2",
    group: "main",
    visible: (ctx) => can(ctx, "request.create"),
  },
  {
    href: "/requests",
    label: "Request Saya",
    labelEn: "My Requests",
    icon: "FileText",
    group: "main",
    match: "/requests",
    visible: () => true,
  },
  {
    href: "/approvals",
    label: "Approval",
    labelEn: "Approval",
    icon: "CheckSquare",
    group: "main",
    visible: (ctx) =>
      canAny(ctx, "approval.hod", "approval.hr", "approval.finance", "approval.gm", "approval.override"),
  },
  {
    href: "/assignments",
    label: "Assignment",
    labelEn: "Assignment",
    icon: "UserCheck",
    group: "operations",
    visible: (ctx) => canAny(ctx, "assignment.manage", "request.read_all"),
  },
  {
    href: "/attendance",
    label: "Absensi Casual",
    labelEn: "Attendance",
    icon: "ClipboardCheck",
    group: "operations",
    visible: (ctx) => canAny(ctx, "attendance.read", "attendance.manage"),
  },
  {
    href: "/casuals",
    label: "Data Casual",
    labelEn: "Casual Database",
    icon: "Users",
    group: "operations",
    match: "/casuals",
    visible: (ctx) => can(ctx, "casual.read"),
  },
  {
    href: "/talent-pool",
    label: "Talent Pool",
    labelEn: "Talent Pool",
    icon: "Star",
    group: "operations",
    visible: (ctx) => can(ctx, "casual.read"),
  },
  {
    href: "/evaluations",
    label: "Evaluasi Casual",
    labelEn: "Evaluation",
    icon: "ClipboardList",
    group: "operations",
    visible: (ctx) => canAny(ctx, "evaluation.read", "evaluation.manage"),
  },
  {
    href: "/payments",
    label: "Payment",
    labelEn: "Payment",
    icon: "Wallet",
    group: "operations",
    visible: (ctx) => can(ctx, "payment.read"),
  },
  {
    href: "/reports",
    label: "Laporan",
    labelEn: "Reports",
    icon: "FileBarChart",
    group: "insight",
    visible: (ctx) => can(ctx, "report.read"),
  },
  {
    href: "/analytics",
    label: "Analytics",
    labelEn: "Analytics",
    icon: "TrendingUp",
    group: "insight",
    visible: (ctx) => can(ctx, "analytics.read"),
  },
  {
    href: "/documents",
    label: "Dokumen Arsip",
    labelEn: "Document Archive",
    icon: "FolderOpen",
    group: "insight",
    visible: (ctx) => can(ctx, "document.read"),
  },
  {
    href: "/users",
    label: "Add User",
    labelEn: "Users",
    icon: "UserPlus",
    group: "admin",
    visible: (ctx) => canAny(ctx, "user.read", "user.manage"),
  },
  {
    href: "/settings",
    label: "Pengaturan",
    labelEn: "Settings",
    icon: "Settings",
    group: "admin",
    match: "/settings",
    visible: (ctx) => canAny(ctx, "settings.manage", "hotel.manage", "department.manage"),
  },
  {
    href: "/audit-log",
    label: "Audit Log",
    labelEn: "Audit Log",
    icon: "ScrollText",
    group: "admin",
    visible: (ctx) => can(ctx, "audit.read"),
  },
  {
    href: "/help",
    label: "Help Center",
    labelEn: "Help Center",
    icon: "LifeBuoy",
    group: "admin",
    visible: () => true,
  },
];

export function visibleNav(ctx: SessionContext): NavItem[] {
  // Rebuild explicitly: `visible` is a function and must not cross the
  // server/client boundary as part of the nav payload.
  return DEFINITIONS.filter((d) => d.visible(ctx)).map((d) => ({
    href: d.href,
    label: d.label,
    labelEn: d.labelEn,
    icon: d.icon,
    group: d.group,
    match: d.match,
  }));
}
