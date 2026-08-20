"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { fail, handleError, ok, type ActionResult } from "@/lib/errors";
import {
  blacklistSchema,
  casualSchema,
  checkInSchema,
  checkOutSchema,
  evaluationSchema,
  fieldErrors,
  markAttendanceSchema,
  paymentAdjustSchema,
  paymentStatusSchema,
} from "@/lib/validation/schemas";

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

// --- Assignment -------------------------------------------------------------

export async function assignCasuals(
  requestId: string,
  casualIds: string[],
): Promise<ActionResult<{ inserted: number }>> {
  const ctx = await requireSession();
  if (casualIds.length === 0) return fail("Pilih minimal satu casual.");

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("assign_casuals", {
      p_request: requestId,
      p_casual_ids: casualIds,
    });
    if (error) throw error;

    revalidatePath("/assignments");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/dashboard");
    return ok({ inserted: Number(data ?? 0) }, `${data} casual berhasil dialokasikan.`);
  } catch (error) {
    return fail(
      await handleError(error, { module: "assignments", action: "assignCasuals", userId: ctx.userId }),
    );
  }
}

export async function unassignCasual(assignmentId: string): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("unassign_casual", { p_assignment: assignmentId });
    if (error) throw error;
    revalidatePath("/assignments");
    return ok(null, "Assignment dibatalkan.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "assignments", action: "unassignCasual", userId: ctx.userId }),
    );
  }
}

// --- Attendance -------------------------------------------------------------

export async function checkIn(input: {
  assignment_id: string;
  latitude?: number;
  longitude?: number;
  method?: "manual" | "qr" | "self";
}): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return fail("Data check-in tidak valid.", fieldErrors(parsed.error));

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("casual_check_in", {
      p_assignment: parsed.data.assignment_id,
      p_latitude: parsed.data.latitude ?? null,
      p_longitude: parsed.data.longitude ?? null,
      p_method: parsed.data.method,
    });
    if (error) throw error;

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return ok(null, "Check-in tercatat.");
  } catch (error) {
    return fail(await handleError(error, { module: "attendance", action: "checkIn", userId: ctx.userId }));
  }
}

export async function checkOut(input: {
  assignment_id: string;
  break_minutes?: number;
  remark?: string;
}): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = checkOutSchema.safeParse(input);
  if (!parsed.success) return fail("Data check-out tidak valid.", fieldErrors(parsed.error));

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("casual_check_out", {
      p_assignment: parsed.data.assignment_id,
      p_break_minutes: parsed.data.break_minutes ?? null,
      p_remark: parsed.data.remark ?? null,
    });
    if (error) throw error;

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return ok(null, "Check-out tercatat. Jam kerja dihitung otomatis.");
  } catch (error) {
    return fail(await handleError(error, { module: "attendance", action: "checkOut", userId: ctx.userId }));
  }
}

export async function markAttendance(input: {
  assignment_id: string;
  status: string;
  remark?: string;
}): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) return fail("Status absensi tidak valid.", fieldErrors(parsed.error));

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("mark_attendance", {
      p_assignment: parsed.data.assignment_id,
      p_status: parsed.data.status,
      p_remark: parsed.data.remark ?? null,
    });
    if (error) throw error;

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return ok(null, "Status absensi diperbarui.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "attendance", action: "markAttendance", userId: ctx.userId }),
    );
  }
}

// --- Casual worker ----------------------------------------------------------

export async function saveCasual(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireSession();
  const raw = formToObject(formData);
  const parsed = casualSchema.safeParse({ ...raw, hotel_id: ctx.activeHotel!.id });
  if (!parsed.success) {
    return fail("Periksa kembali isian formulir.", fieldErrors(parsed.error));
  }

  const { id, ...input } = parsed.data;
  const supabase = await createClient();

  const payload = {
    hotel_id: input.hotel_id,
    full_name: input.full_name,
    nickname: input.nickname ?? null,
    place_of_birth: input.place_of_birth ?? null,
    date_of_birth: input.date_of_birth ?? null,
    gender: input.gender ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    preferred_department_id: input.preferred_department_id ?? null,
    skills: input.skills,
    hotel_experience_years: input.hotel_experience_years,
    previous_employer: input.previous_employer ?? null,
    join_date: input.join_date ?? new Date().toISOString().slice(0, 10),
    emergency_name: input.emergency_name ?? null,
    emergency_relationship: input.emergency_relationship ?? null,
    emergency_phone: input.emergency_phone ?? null,
    status: input.status,
    notes: input.notes ?? null,
  };

  try {
    let casualId: string;
    if (id) {
      const { data, error } = await supabase
        .from("casual_workers")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      casualId = data.id;
    } else {
      const { data, error } = await supabase
        .from("casual_workers")
        .insert({ ...payload, created_by: ctx.userId })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      casualId = data.id;
    }

    revalidatePath("/casuals");
    revalidatePath("/talent-pool");
    return ok({ id: casualId }, id ? "Data casual diperbarui." : "Casual baru ditambahkan.");
  } catch (error) {
    return fail(await handleError(error, { module: "casuals", action: "saveCasual", userId: ctx.userId }));
  }
}

export async function addToBlacklist(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = blacklistSchema.safeParse({
    ...formToObject(formData),
    hotel_id: ctx.activeHotel!.id,
  });
  if (!parsed.success) {
    return fail("Alasan blacklist wajib diisi minimal 5 karakter.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase.from("blacklist").insert({
      casual_id: parsed.data.casual_id,
      hotel_id: parsed.data.hotel_id,
      reason: parsed.data.reason,
      created_by: ctx.userId,
    });
    if (error) throw error;

    revalidatePath("/talent-pool");
    revalidatePath("/casuals");
    return ok(null, "Casual dimasukkan ke blacklist.");
  } catch (error) {
    return fail(await handleError(error, { module: "casuals", action: "addToBlacklist", userId: ctx.userId }));
  }
}

export async function releaseBlacklist(
  casualId: string,
  reason: string,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("blacklist")
      .update({
        released_at: new Date().toISOString(),
        released_by: ctx.userId,
        release_reason: reason,
      })
      .eq("casual_id", casualId)
      .is("released_at", null);
    if (error) throw error;

    revalidatePath("/talent-pool");
    revalidatePath("/casuals");
    return ok(null, "Blacklist dicabut.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "casuals", action: "releaseBlacklist", userId: ctx.userId }),
    );
  }
}

// --- Evaluation -------------------------------------------------------------

export async function saveEvaluation(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = evaluationSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Semua kriteria wajib dinilai 1-5.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  try {
    const { data: assignment, error: readError } = await supabase
      .from("assignments")
      .select("id, request_id, casual_id, hotel_id, department_id")
      .eq("id", parsed.data.assignment_id)
      .single<{
        id: string;
        request_id: string;
        casual_id: string;
        hotel_id: string;
        department_id: string;
      }>();
    if (readError) throw readError;

    const { error } = await supabase.from("evaluations").upsert(
      {
        assignment_id: assignment.id,
        request_id: assignment.request_id,
        casual_id: assignment.casual_id,
        hotel_id: assignment.hotel_id,
        department_id: assignment.department_id,
        evaluator_id: ctx.userId,
        score_attendance: parsed.data.score_attendance,
        score_discipline: parsed.data.score_discipline,
        score_attitude: parsed.data.score_attitude,
        score_grooming: parsed.data.score_grooming,
        score_skill: parsed.data.score_skill,
        score_teamwork: parsed.data.score_teamwork,
        score_communication: parsed.data.score_communication,
        score_overall: parsed.data.score_overall,
        strength: parsed.data.strength ?? null,
        improvement: parsed.data.improvement ?? null,
        recommendation: parsed.data.recommendation ?? null,
        updated_by: ctx.userId,
      },
      { onConflict: "assignment_id" },
    );
    if (error) throw error;

    revalidatePath("/evaluations");
    revalidatePath("/talent-pool");
    return ok(null, "Evaluasi tersimpan. Rating casual diperbarui otomatis.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "evaluations", action: "saveEvaluation", userId: ctx.userId }),
    );
  }
}

// --- Payment ----------------------------------------------------------------

export async function generatePayments(requestId: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireSession();
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("generate_payments", { p_request: requestId });
    if (error) throw error;
    revalidatePath("/payments");
    return ok({ count: Number(data ?? 0) }, `${data} baris pembayaran dibuat.`);
  } catch (error) {
    return fail(
      await handleError(error, { module: "payments", action: "generatePayments", userId: ctx.userId }),
    );
  }
}

export async function adjustPayment(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = paymentAdjustSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Nilai penyesuaian tidak valid.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("payments")
      .update({
        allowance: parsed.data.allowance,
        deduction: parsed.data.deduction,
        notes: parsed.data.notes ?? null,
      })
      .eq("id", parsed.data.payment_id)
      .neq("status", "paid");
    if (error) throw error;

    revalidatePath("/payments");
    return ok(null, "Penyesuaian pembayaran tersimpan.");
  } catch (error) {
    return fail(await handleError(error, { module: "payments", action: "adjustPayment", userId: ctx.userId }));
  }
}

export async function setPaymentStatus(
  paymentId: string,
  status: "pending" | "verified" | "approved" | "paid",
  reference?: string,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = paymentStatusSchema.safeParse({ payment_id: paymentId, status, reference });
  if (!parsed.success) return fail("Status pembayaran tidak valid.");

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("set_payment_status", {
      p_payment: parsed.data.payment_id,
      p_status: parsed.data.status,
      p_reference: parsed.data.reference ?? null,
    });
    if (error) throw error;

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return ok(null, "Status pembayaran diperbarui.");
  } catch (error) {
    return fail(
      await handleError(error, { module: "payments", action: "setPaymentStatus", userId: ctx.userId }),
    );
  }
}
