import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Casual Request",
    template: "%s · Casual Request",
  },
  description:
    "Casual Workforce Management Platform untuk hotel — request, approval, assignment, absensi, dan biaya casual dalam satu alur digital.",
  applicationName: "Casual Request",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0c121c" },
  ],
};

/**
 * Applies the stored theme before first paint so the page never flashes the
 * wrong palette (PRD §59).
 */
const THEME_SCRIPT = `
(function () {
  try {
    var m = document.cookie.match(/(?:^|; )cr_theme=([^;]*)/);
    var pref = m ? decodeURIComponent(m[1]) : 'system';
    var dark = pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const locale = store.get("cr_locale")?.value === "en" ? "en" : "id";

  return (
    <html lang={locale} className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
