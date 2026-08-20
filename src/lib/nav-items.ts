/**
 * Client-safe navigation types and labels.
 *
 * Kept apart from lib/navigation.ts on purpose: that module imports the session
 * helpers, which reach for next/headers and must never be pulled into a Client
 * Component bundle.
 */

export interface NavItem {
  href: string;
  label: string;
  labelEn: string;
  icon: string;
  group: "main" | "operations" | "insight" | "admin";
  /** Sub-routes that should also light this item up. */
  match?: string;
}

export const NAV_GROUP_LABEL: Record<NavItem["group"], { id: string; en: string }> = {
  main: { id: "Utama", en: "Main" },
  operations: { id: "Operasional", en: "Operations" },
  insight: { id: "Laporan & Analitik", en: "Reporting" },
  admin: { id: "Administrasi", en: "Administration" },
};
