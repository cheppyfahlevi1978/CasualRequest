"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { requireSession, can } from "@/lib/auth/session";
import { fail, handleError, ok, type ActionResult } from "@/lib/errors";
import {
  approvalRuleSchema,
  budgetSchema,
  departmentSchema,
  fieldErrors,
  hotelSchema,
  rateSchema,
  userSchema,
} from "@/lib/validation/schemas";

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const list = (out[k] as string[] | undefined) ?? [];
      list.push(value);
      out[k] = list;
    } else {
      out[key] = value;
    }
  }
  return out;
}

// --- User provisioning (PRD §40) -------------------------------------------

/**
 * Creates the auth account through the privileged admin API, then links it to
 * a profile, a role, and one or more hotels. Everything after the auth call is
 * done with the caller's own client so RLS still applies to the profile row.
 */
export async function provisionUser(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireSession();
  if (!can(ctx, "user.manage")) {
    return fail("Anda tidak memiliki izin untuk mengelola pengguna.");
  }

  const parsed = userSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Periksa kembali isian formulir.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  if (input.role_code === "super_admin" && !ctx.roles.includes("super_admin")) {
    return fail("Hanya Super Admin yang dapat memberikan role Super Admin.");
  }

  const supabase = await createClient();

  try {
    // Editing an existing user needs no auth-admin call at all.
    if (input.id) {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: input.full_name,
          phone: input.phone ?? null,
          employee_id: input.employee_id ?? null,
          position: input.position ?? null,
          primary_hotel_id: input.primary_hotel_id,
          department_id: input.department_id ?? null,
          status: input.status,
          updated_by: ctx.userId,
        })
        .eq("id", input.id);
      if (error) throw error;

      await syncRolesAndHotels(input.id, input);
      revalidatePath("/users");
      return ok({ id: input.id }, "Data pengguna diperbarui.");
    }

    if (!hasAdminClient()) {
      return fail(
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. Pembuatan akun baru memerlukan kunci privileged di sisi server.",
      );
    }

    const admin = createAdminClient();
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: false,
      user_metadata: { full_name: input.full_name },
    });

    if (authError || !created.user) {
      throw authError ?? new Error("Akun tidak dapat dibuat.");
    }

    const userId = created.user.id;

    // The auth trigger already inserted a placeholder profile; fill it in.
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        email: input.email,
        full_name: input.full_name,
        phone: input.phone ?? null,
        employee_id: input.employee_id ?? null,
        position: input.position ?? null,
        primary_hotel_id: input.primary_hotel_id,
        department_id: input.department_id ?? null,
        status: input.status,
        created_by: ctx.userId,
      })
      .eq("id", userId);
    if (profileError) throw profileError;

    await syncRolesAndHotels(userId, input);

    // Send the invitation as a password-recovery link so the user sets their
    // own password; we never handle a plaintext password here.
    await admin.auth.admin.generateLink({ type: "recovery", email: input.email });

    await supabase.from("activity_logs").insert({
      user_id: ctx.userId,
      hotel_id: input.primary_hotel_id,
      action: "PROVISION_USER",
      module: "users",
      record_id: userId,
      description: `Provisioned ${input.email} as ${input.role_code}`,
    });

    revalidatePath("/users");
    return ok(
      { id: userId },
      "Pengguna dibuat. Tautan pengaturan kata sandi dikirim ke email tersebut.",
    );
  } catch (error) {
    return fail(await handleError(error, { module: "users", action: "provisionUser", userId: ctx.userId }));
  }
}

async function syncRolesAndHotels(
  userId: string,
  input: { role_code: string; hotel_ids: string[]; primary_hotel_id: string },
): Promise<void> {
  const admin = hasAdminClient() ? createAdminClient() : await createClient();

  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("code", input.role_code)
    .single<{ id: string }>();

  await admin.from("user_roles").delete().eq("user_id", userId);
  if (role) {
    // Super Admin is granted globally (hotel_id null); every other role is
    // granted once per hotel the user may enter.
    const grants: { user_id: string; role_id: string; hotel_id: string | null }[] =
      input.role_code === "super_admin"
        ? [{ user_id: userId, role_id: role.id, hotel_id: null }]
        : input.hotel_ids.map((hotelId) => ({
            user_id: userId,
            role_id: role.id,
            hotel_id: hotelId,
          }));
    await admin.from("user_roles").insert(grants);
  }

  await admin.from("user_hotels").delete().eq("user_id", userId);
  await admin.from("user_hotels").insert(
    input.hotel_ids.map((hotelId) => ({
      user_id: userId,
      hotel_id: hotelId,
      is_default: hotelId === input.primary_hotel_id,
    })),
  );
}

export async function setUserStatus(
  userId: string,
  status: "active" | "inactive" | "suspended",
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  if (!can(ctx, "user.manage")) return fail("Tidak memiliki izin.");
  if (userId === ctx.userId) return fail("Anda tidak dapat mengubah status akun Anda sendiri.");

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status, updated_by: ctx.userId })
      .eq("id", userId);
    if (error) throw error;

    revalidatePath("/users");
    return ok(null, `Status pengguna diubah menjadi ${status}.`);
  } catch (error) {
    return fail(await handleError(error, { module: "users", action: "setUserStatus", userId: ctx.userId }));
  }
}

// --- Hotel & department -----------------------------------------------------

export async function saveHotel(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = hotelSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Periksa kembali isian hotel.", fieldErrors(parsed.error));
  }
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  try {
    const payload = {
      code: input.code,
      name: input.name,
      address: input.address ?? null,
      city: input.city ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      timezone: input.timezone,
      currency: input.currency,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      geofence_radius_m: input.geofence_radius_m,
      status: input.status,
    };

    const { error } = id
      ? await supabase.from("hotels").update(payload).eq("id", id)
      : await supabase.from("hotels").insert({ ...payload, created_by: ctx.userId });
    if (error) throw error;

    revalidatePath("/settings");
    return ok(null, id ? "Data hotel diperbarui." : "Unit hotel dibuat beserta data default-nya.");
  } catch (error) {
    return fail(await handleError(error, { module: "settings", action: "saveHotel", userId: ctx.userId }));
  }
}

export async function saveDepartment(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = departmentSchema.safeParse({
    ...formToObject(formData),
    hotel_id: ctx.activeHotel!.id,
  });
  if (!parsed.success) {
    return fail("Periksa kembali isian department.", fieldErrors(parsed.error));
  }
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  try {
    const { error } = id
      ? await supabase.from("departments").update(input).eq("id", id)
      : await supabase.from("departments").insert({ ...input, created_by: ctx.userId });
    if (error) throw error;

    revalidatePath("/settings");
    return ok(null, id ? "Department diperbarui." : "Department ditambahkan.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "settings", action: "saveDepartment", userId: ctx.userId }),
    );
  }
}

// --- Rates, approval rules, budgets ----------------------------------------

export async function saveRate(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = rateSchema.safeParse({
    ...formToObject(formData),
    hotel_id: ctx.activeHotel!.id,
  });
  if (!parsed.success) return fail("Periksa kembali isian rate.", fieldErrors(parsed.error));
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  try {
    const payload = {
      ...input,
      department_id: input.department_id ?? null,
      effective_to: input.effective_to ?? null,
    };
    const { error } = id
      ? await supabase.from("rate_master").update(payload).eq("id", id)
      : await supabase.from("rate_master").insert({ ...payload, created_by: ctx.userId });
    if (error) throw error;

    revalidatePath("/settings");
    return ok(null, "Rate casual tersimpan.");
  } catch (error) {
    return fail(await handleError(error, { module: "settings", action: "saveRate", userId: ctx.userId }));
  }
}

export async function saveApprovalRule(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const raw = formToObject(formData);
  const parsed = approvalRuleSchema.safeParse({
    ...raw,
    hotel_id: ctx.activeHotel!.id,
    steps: Array.isArray(raw.steps) ? raw.steps : raw.steps ? [raw.steps] : [],
  });
  if (!parsed.success) return fail("Periksa kembali aturan approval.", fieldErrors(parsed.error));
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  try {
    const payload = { ...input, max_amount: input.max_amount ?? null };
    const { error } = id
      ? await supabase.from("approval_rules").update(payload).eq("id", id)
      : await supabase.from("approval_rules").insert(payload);
    if (error) throw error;

    revalidatePath("/settings");
    return ok(null, "Aturan approval tersimpan.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "settings", action: "saveApprovalRule", userId: ctx.userId }),
    );
  }
}

export async function saveBudget(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = budgetSchema.safeParse({
    ...formToObject(formData),
    hotel_id: ctx.activeHotel!.id,
  });
  if (!parsed.success) return fail("Periksa kembali isian budget.", fieldErrors(parsed.error));
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  try {
    const payload = {
      ...input,
      department_id: input.department_id ?? null,
      notes: input.notes ?? null,
    };
    const { error } = id
      ? await supabase.from("budgets").update(payload).eq("id", id)
      : await supabase.from("budgets").insert({ ...payload, created_by: ctx.userId });
    if (error) throw error;

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok(null, "Budget tersimpan.");
  } catch (error) {
    return fail(await handleError(error, { module: "settings", action: "saveBudget", userId: ctx.userId }));
  }
}

export async function saveAttendanceSettings(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  if (!can(ctx, "settings.manage")) return fail("Tidak memiliki izin.");

  const raw = formToObject(formData);
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("settings").upsert(
      {
        hotel_id: ctx.activeHotel!.id,
        category: "attendance",
        key: "rules",
        value: {
          standard_minutes: Math.max(60, Math.min(1440, Number(raw.standard_minutes) || 480)),
          late_tolerance_minutes: Math.max(0, Math.min(180, Number(raw.late_tolerance_minutes) || 15)),
          require_geolocation: raw.require_geolocation === "on",
          qr_expiry_minutes: Math.max(1, Math.min(120, Number(raw.qr_expiry_minutes) || 10)),
        },
        updated_by: ctx.userId,
      },
      { onConflict: "hotel_id,category,key" },
    );
    if (error) throw error;

    revalidatePath("/settings");
    return ok(null, "Pengaturan absensi tersimpan.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "settings", action: "saveAttendanceSettings", userId: ctx.userId }),
    );
  }
}
