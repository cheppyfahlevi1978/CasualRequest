"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setLocale, setTheme } from "@/server/actions/auth";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";

export function ProfilePreferences({
  locale,
  theme,
  notifyEmail,
  notifyInapp,
}: {
  locale: "id" | "en";
  theme: "light" | "dark" | "system";
  notifyEmail: boolean;
  notifyInapp: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [values, setValues] = React.useState({
    locale,
    theme,
    notifyEmail,
    notifyInapp,
  });

  const save = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({
            notify_email: values.notifyEmail,
            notify_inapp: values.notifyInapp,
          })
          .eq("id", user.id);
        if (error) throw error;
      }

      await setLocale(values.locale);
      await setTheme(values.theme);

      // Apply the theme immediately rather than waiting for the next paint.
      const dark =
        values.theme === "dark" ||
        (values.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);

      toast.success("Preferensi tersimpan");
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan", "Preferensi tidak dapat disimpan saat ini.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Bahasa" htmlFor="pref-locale">
        <select
          id="pref-locale"
          value={values.locale}
          onChange={(e) => setValues((v) => ({ ...v, locale: e.target.value as "id" | "en" }))}
          className="cr-input"
        >
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </Field>

      <Field label="Tema" htmlFor="pref-theme">
        <select
          id="pref-theme"
          value={values.theme}
          onChange={(e) =>
            setValues((v) => ({ ...v, theme: e.target.value as "light" | "dark" | "system" }))
          }
          className="cr-input"
        >
          <option value="system">Ikuti sistem</option>
          <option value="light">Terang</option>
          <option value="dark">Gelap</option>
        </select>
      </Field>

      <div className="space-y-2">
        <p className="cr-label">Notifikasi</p>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={values.notifyInapp}
            onChange={(e) => setValues((v) => ({ ...v, notifyInapp: e.target.checked }))}
            className="h-4 w-4 rounded border-border-strong"
          />
          Notifikasi dalam aplikasi
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={values.notifyEmail}
            onChange={(e) => setValues((v) => ({ ...v, notifyEmail: e.target.checked }))}
            className="h-4 w-4 rounded border-border-strong"
          />
          Notifikasi email
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className={buttonClass("primary", "sm", "w-full")}
      >
        {busy ? "Menyimpan…" : "Simpan preferensi"}
      </button>
    </div>
  );
}
