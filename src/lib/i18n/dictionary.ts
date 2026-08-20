/**
 * Translation object (PRD §62).
 *
 * Indonesian is the primary language of the product; English is the fallback
 * for international management. Screens read from this object rather than
 * embedding copy, so a third language is an additive change.
 */

export type Locale = "id" | "en";

export const LOCALE_COOKIE = "cr_locale";

export const dictionary = {
  id: {
    "app.name": "Casual Request",
    "app.tagline": "Casual Workforce Management untuk hotel",
    "common.search": "Cari",
    "common.filter": "Filter",
    "common.reset": "Reset",
    "common.apply": "Terapkan",
    "common.save": "Simpan",
    "common.cancel": "Batal",
    "common.close": "Tutup",
    "common.export": "Export CSV",
    "common.print": "Cetak",
    "common.loading": "Memuat…",
    "common.empty": "Belum ada data",
    "common.all": "Semua",
    "common.actions": "Aksi",
    "common.detail": "Detail",
    "common.back": "Kembali",
    "topbar.connected": "Terhubung",
    "topbar.degraded": "Koneksi bermasalah",
    "topbar.disconnected": "Terputus",
    "topbar.notifications": "Notifikasi",
    "topbar.markAllRead": "Tandai semua dibaca",
    "topbar.noNotifications": "Tidak ada notifikasi",
    "topbar.theme": "Tema",
    "topbar.language": "Bahasa",
    "topbar.logout": "Keluar",
    "topbar.profile": "Profil Saya",
    "topbar.hotel": "Unit Hotel",
    "auth.signIn": "Masuk",
    "auth.signInGoogle": "Masuk dengan Google",
    "auth.email": "Email",
    "auth.password": "Kata Sandi",
    "auth.forgot": "Lupa kata sandi?",
    "auth.denied": "Akses Ditolak",
  },
  en: {
    "app.name": "Casual Request",
    "app.tagline": "Casual workforce management for hotels",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.reset": "Reset",
    "common.apply": "Apply",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.export": "Export CSV",
    "common.print": "Print",
    "common.loading": "Loading…",
    "common.empty": "No data yet",
    "common.all": "All",
    "common.actions": "Actions",
    "common.detail": "Detail",
    "common.back": "Back",
    "topbar.connected": "Connected",
    "topbar.degraded": "Degraded",
    "topbar.disconnected": "Disconnected",
    "topbar.notifications": "Notifications",
    "topbar.markAllRead": "Mark all as read",
    "topbar.noNotifications": "No notifications",
    "topbar.theme": "Theme",
    "topbar.language": "Language",
    "topbar.logout": "Sign out",
    "topbar.profile": "My Profile",
    "topbar.hotel": "Hotel Unit",
    "auth.signIn": "Sign in",
    "auth.signInGoogle": "Continue with Google",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgot": "Forgot your password?",
    "auth.denied": "Access Denied",
  },
} as const;

export type TranslationKey = keyof (typeof dictionary)["id"];

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionary[locale][key] ?? dictionary.id[key] ?? key;
}
