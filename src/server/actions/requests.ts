"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { fail, handleError, ok, type ActionResult } from "@/lib/errors";
import {
  cancelSchema,
  decisionSchema,
  estimateCost,
  fieldErrors,
  requestSchema,
} from "@/lib/validation/schemas";

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Creates a draft request. Nothing enters the workflow until it is submitted. */
export async function saveRequest(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireSession();
  const raw = formToObject(formData);
  const requestId = typeof raw.id === "string" && raw.id ? raw.id : null;
  const submit = raw.intent === "submit";

  const parsed = requestSchema.safeParse({ ...raw, hotel_id: ctx.activeHotel!.id });
  if (!parsed.success) {
    return fail("Periksa kembali isian formulir.", fieldErrors(parsed.error));
  }

  const input = parsed.data;
  const supabase = await createClient();

  const payload = {
    hotel_id: input.hotel_id,
    department_id: input.department_id,
    position_required: input.position_required,
    request_type: input.request_type,
    event_name: input.event_name ?? null,
    work_date: input.work_date,
    start_time: input.start_time,
    end_time: input.end_time,
    shift_id: input.shift_id ?? null,
    qty_required: input.qty_required,
    gender_preference: input.gender_preference ?? null,
    experience_required: input.experience_required ?? null,
    rate: input.rate,
    estimated_hours: input.estimated_hours,
    // Recomputed server-side: the browser's number is a preview, not the truth.
    estimated_cost: estimateCost(input.rate, input.qty_required),
    reason: input.reason,
    location: input.location ?? null,
    notes: input.notes ?? null,
  };

  try {
    let id: string;

    if (requestId) {
      const { data, error } = await supabase
        .from("casual_requests")
        .update(payload)
        .eq("id", requestId)
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      id = data.id;
    } else {
      const { data, error } = await supabase
        .from("casual_requests")
        .insert({
          ...payload,
          requester_id: ctx.userId,
          created_by: ctx.userId,
          status: "draft",
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      id = data.id;
    }

    if (submit) {
      const { error } = await supabase.rpc("submit_request", { p_request: id });
      if (error) throw error;
    }

    revalidatePath("/requests");
    revalidatePath("/approvals");
    revalidatePath("/dashboard");

    return ok(
      { id },
      submit ? "Request berhasil diajukan untuk approval." : "Draft request tersimpan.",
    );
  } catch (error) {
    return fail(await handleError(error, { module: "requests", action: "saveRequest", userId: ctx.userId }));
  }
}

export async function submitRequest(requestId: string): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const supabase = await createClient();

  try {
    const { error } = await supabase.rpc("submit_request", { p_request: requestId });
    if (error) throw error;

    revalidatePath("/requests");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/approvals");
    return ok(null, "Request diajukan untuk approval.");
  } catch (error) {
    return fail(await handleError(error, { module: "requests", action: "submitRequest", userId: ctx.userId }));
  }
}

/**
 * Approve / reject / return. The decision itself is applied by decide_request()
 * inside the database, which re-checks authority, step order and self-approval
 * (PRD §17, §63, §66).
 */
export async function decideRequest(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = decisionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Keputusan tidak valid.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const h = await headers();

  try {
    const { error } = await supabase.rpc("decide_request", {
      p_request: parsed.data.request_id,
      p_decision: parsed.data.decision,
      p_remark: parsed.data.remark ?? null,
      p_session: {
        user_agent: (h.get("user-agent") ?? "").slice(0, 200),
        at: new Date().toISOString(),
      },
    });
    if (error) throw error;

    revalidatePath("/approvals");
    revalidatePath("/requests");
    revalidatePath(`/requests/${parsed.data.request_id}`);
    revalidatePath("/dashboard");

    const label =
      parsed.data.decision === "approved"
        ? "disetujui"
        : parsed.data.decision === "rejected"
          ? "ditolak"
          : "dikembalikan untuk revisi";
    return ok(null, `Request ${label}.`);
  } catch (error) {
    return fail(await handleError(error, { module: "approvals", action: "decideRequest", userId: ctx.userId }));
  }
}

export async function cancelRequest(
  _prev: ActionResult<null> | undefined,
  formData: FormData,
): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const parsed = cancelSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("Alasan pembatalan wajib diisi.", fieldErrors(parsed.error));
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("cancel_request", {
      p_request: parsed.data.request_id,
      p_reason: parsed.data.reason,
    });
    if (error) throw error;

    revalidatePath("/requests");
    revalidatePath(`/requests/${parsed.data.request_id}`);
    return ok(null, "Request dibatalkan.");
  } catch (error) {
    return fail(await handleError(error, { module: "requests", action: "cancelRequest", userId: ctx.userId }));
  }
}

export async function closeRequest(requestId: string): Promise<ActionResult<null>> {
  const ctx = await requireSession();
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("close_request", { p_request: requestId });
    if (error) throw error;
    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/requests");
    return ok(null, "Request ditutup.");
  } catch (error) {
    return fail(await handleError(error, { module: "requests", action: "closeRequest", userId: ctx.userId }));
  }
}

/** Duplicate an existing request into a fresh draft (PRD §14). */
export async function duplicateRequest(requestId: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireSession();
  const supabase = await createClient();

  try {
    const { data: source, error: readError } = await supabase
      .from("casual_requests")
      .select(
        "hotel_id, department_id, position_required, request_type, event_name, work_date, " +
          "start_time, end_time, shift_id, qty_required, gender_preference, experience_required, " +
          "rate, estimated_hours, estimated_cost, reason, location, notes",
      )
      .eq("id", requestId)
      .single<Record<string, unknown>>();
    if (readError) throw readError;

    const { data, error } = await supabase
      .from("casual_requests")
      .insert({
        ...source,
        requester_id: ctx.userId,
        created_by: ctx.userId,
        status: "draft",
        request_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;

    revalidatePath("/requests");
    return ok({ id: data.id }, "Draft baru dibuat dari request ini.");
  } catch (error) {
    return fail(await handleError(error, { module: "requests", action: "duplicateRequest", userId: ctx.userId }));
  }
}
