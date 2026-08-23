"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv, serverEnv } from "@/lib/env";
import { ACTIVE_HOTEL_COOKIE } from "@/lib/auth/session";
import { LOCALE_COOKIE } from "@/lib/i18n/dictionary";
import { handleError } from "@/lib/errors";

const COOKIE_BASE = {
  httpOnly: false as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
};

async function origin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return publicEnv.appUrl;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  next: z.string().optional(),
});

export type AuthFormState = { error?: string; notice?: string };

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data login tidak valid" };
  }

  const { email, password } = parsed.data;

  const allowed = serverEnv.allowedEmailDomains;
  if (allowed.length > 0 && !allowed.some((d) => email.endsWith(`@${d}`))) {
    return { error: "Domain email ini tidak diizinkan mengakses aplikasi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Never reveal whether the address exists.
    return { error: "Email atau kata sandi salah." };
  }

  const target = parsed.data.next?.startsWith("/") ? parsed.data.next : "/dashboard";
  redirect(target);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = String(formData.get("next") ?? "/dashboard");

  // Hiding the button is not authorization (PRD §63): refuse here too when the
  // provider has not been configured, so a hand-crafted POST cannot reach it.
  if (!publicEnv.googleAuthEnabled) {
    redirect(
      `/login?error=${encodeURIComponent("Login Google belum diaktifkan. Gunakan email dan kata sandi.")}`,
    );
  }

  const supabase = await createClient();
  const base = await origin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent("Google sign-in tidak tersedia saat ini.")}`);
  }

  redirect(data.url);
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
});

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email tidak valid" };
  }

  const supabase = await createClient();
  const base = await origin();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${base}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, whether or not the address exists.
  return {
    notice:
      "Jika email tersebut terdaftar, tautan pemulihan sudah dikirim. Periksa kotak masuk Anda.",
  };
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Kata sandi minimal 10 karakter")
      .regex(/[a-z]/, "Harus memuat huruf kecil")
      .regex(/[A-Z]/, "Harus memuat huruf besar")
      .regex(/[0-9]/, "Harus memuat angka"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirm"],
  });

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Kata sandi tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: await handleError(error, { module: "auth", action: "updatePassword" }) };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "LOGOUT",
      module: "auth",
      description: "User signed out",
    });
  }

  await supabase.auth.signOut();

  const store = await cookies();
  store.delete(ACTIVE_HOTEL_COOKIE);

  redirect("/login");
}

export async function setActiveHotel(hotelId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_HOTEL_COOKIE, hotelId, COOKIE_BASE);
}

export async function setLocale(locale: "id" | "en"): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, COOKIE_BASE);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }
}

export async function setTheme(theme: "light" | "dark" | "system"): Promise<void> {
  const store = await cookies();
  store.set("cr_theme", theme, COOKIE_BASE);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ theme }).eq("id", user.id);
  }
}

const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Nama lengkap minimal 3 karakter")
      .max(120, "Nama lengkap terlalu panjang"),
    email: z.string().trim().toLowerCase().email("Format email tidak valid"),
    password: z
      .string()
      .min(10, "Kata sandi minimal 10 karakter")
      .regex(/[a-z]/, "Harus memuat huruf kecil")
      .regex(/[A-Z]/, "Harus memuat huruf besar")
      .regex(/[0-9]/, "Harus memuat angka"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirm"],
  });

/**
 * Self-service registration (PRD §40, §41, §42).
 *
 * Signing up only creates the identity. `app.handle_new_auth_user()` inserts the
 * matching profile with status 'pending', so a fresh account carries no role, no
 * hotel, and therefore no data access until an administrator activates it. That
 * is deliberate: registration is not authorization.
 */
export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid" };
  }

  const { fullName, email, password } = parsed.data;

  const allowed = serverEnv.allowedEmailDomains;
  if (allowed.length > 0 && !allowed.some((d) => email.endsWith(`@${d}`))) {
    return { error: "Domain email ini tidak diizinkan mendaftar." };
  }

  const supabase = await createClient();
  const base = await origin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${base}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: await handleError(error, { module: "auth", action: "signUp" }) };
  }

  // Confirmation disabled on the project: the session exists immediately. A
  // normal sign-up is still 'pending' and belongs on Access Denied, but the very
  // first administrator is activated by the bootstrap trigger, so read the
  // profile back rather than assuming.
  if (data.session && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle<{ status: string }>();

    redirect(profile?.status === "active" ? "/dashboard" : "/access-denied?reason=inactive");
  }

  return {
    notice:
      "Pendaftaran diterima. Periksa email Anda untuk tautan verifikasi, lalu tunggu Super Admin " +
      "menetapkan peran dan unit hotel sebelum aplikasi dapat digunakan.",
  };
}
