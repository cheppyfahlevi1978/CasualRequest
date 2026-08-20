import { z } from "zod";

/**
 * Server-side schemas (PRD §64).
 *
 * Every Server Action parses its input here before touching the database. The
 * database constraints in migrations 02-03 are the second line of defence, so
 * a bypassed client can still not write invalid data.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(min, `${label} minimal ${min} karakter`).max(max, `${label} terlalu panjang`));

const optionalText = (max = 500) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max))
    .optional()
    .or(z.literal("").transform(() => undefined));

const uuid = z.string().uuid("Referensi tidak valid");
const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(uuid.optional());

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");
const isoTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format jam harus HH:MM");

const money = z.coerce
  .number({ message: "Harus berupa angka" })
  .min(0, "Tidak boleh negatif")
  .max(9_999_999_999, "Nilai terlalu besar");

// --- Casual request (PRD §10) ----------------------------------------------

export const requestSchema = z
  .object({
    hotel_id: uuid,
    department_id: uuid,
    position_required: trimmed(2, 80, "Posisi"),
    request_type: z.enum(["operational", "event"]),
    event_name: optionalText(160),
    work_date: isoDate,
    start_time: isoTime,
    end_time: isoTime,
    shift_id: optionalUuid,
    qty_required: z.coerce
      .number({ message: "Jumlah harus berupa angka" })
      .int("Jumlah harus bilangan bulat")
      .min(1, "Minimal 1 casual")
      .max(500, "Maksimal 500 casual per request"),
    gender_preference: z
      .enum(["male", "female"])
      .optional()
      .or(z.literal("").transform(() => undefined)),
    experience_required: optionalText(200),
    rate: money,
    estimated_hours: z.coerce.number().min(0.5, "Minimal 0,5 jam").max(24, "Maksimal 24 jam"),
    reason: trimmed(5, 1000, "Alasan"),
    location: optionalText(160),
    notes: optionalText(1000),
  })
  .refine((v) => v.request_type !== "event" || Boolean(v.event_name), {
    message: "Nama event wajib diisi untuk request bertipe Event",
    path: ["event_name"],
  });

export type RequestInput = z.infer<typeof requestSchema>;

/** Estimated Cost = Rate × Quantity (PRD §10). */
export function estimateCost(rate: number, qty: number): number {
  return Math.round(Number(rate || 0) * Number(qty || 0) * 100) / 100;
}

// --- Approval ---------------------------------------------------------------

export const decisionSchema = z.object({
  request_id: uuid,
  decision: z.enum(["approved", "rejected", "returned"]),
  remark: optionalText(1000),
});

export const cancelSchema = z.object({
  request_id: uuid,
  reason: trimmed(3, 500, "Alasan pembatalan"),
});

// --- Assignment -------------------------------------------------------------

export const assignSchema = z.object({
  request_id: uuid,
  casual_ids: z.array(uuid).min(1, "Pilih minimal satu casual"),
});

// --- Casual worker (PRD §21) ------------------------------------------------

export const casualSchema = z.object({
  id: optionalUuid,
  hotel_id: uuid,
  full_name: trimmed(3, 120, "Nama lengkap"),
  nickname: optionalText(60),
  place_of_birth: optionalText(80),
  date_of_birth: isoDate.optional().or(z.literal("").transform(() => undefined)),
  gender: z
    .enum(["male", "female"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(8, "Nomor telepon minimal 8 digit").max(24))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email("Format email tidak valid"))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: optionalText(300),
  preferred_department_id: optionalUuid,
  skills: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  hotel_experience_years: z.coerce.number().min(0).max(60).default(0),
  previous_employer: optionalText(160),
  join_date: isoDate.optional().or(z.literal("").transform(() => undefined)),
  emergency_name: optionalText(120),
  emergency_relationship: optionalText(60),
  emergency_phone: optionalText(24),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: optionalText(1000),
});

export const blacklistSchema = z.object({
  casual_id: uuid,
  hotel_id: uuid,
  reason: trimmed(5, 1000, "Alasan blacklist"),
});

// --- Attendance (PRD §24) ---------------------------------------------------

export const checkInSchema = z.object({
  assignment_id: uuid,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  method: z.enum(["manual", "qr", "self"]).default("manual"),
});

export const checkOutSchema = z.object({
  assignment_id: uuid,
  break_minutes: z.coerce.number().int().min(0).max(600).optional(),
  remark: optionalText(500),
});

export const markAttendanceSchema = z.object({
  assignment_id: uuid,
  status: z.enum(["present", "late", "absent", "no_show", "sick", "permission"]),
  remark: optionalText(500),
});

// --- Evaluation (PRD §33) ---------------------------------------------------

const score = z.coerce
  .number({ message: "Nilai harus 1-5" })
  .int()
  .min(1, "Nilai minimal 1")
  .max(5, "Nilai maksimal 5");

export const evaluationSchema = z.object({
  assignment_id: uuid,
  score_attendance: score,
  score_discipline: score,
  score_attitude: score,
  score_grooming: score,
  score_skill: score,
  score_teamwork: score,
  score_communication: score,
  score_overall: score,
  strength: optionalText(500),
  improvement: optionalText(500),
  recommendation: z
    .enum(["rehire", "consider", "do_not_rehire"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// --- Payment (PRD §29-30) ---------------------------------------------------

export const paymentAdjustSchema = z.object({
  payment_id: uuid,
  allowance: money.default(0),
  deduction: money.default(0),
  notes: optionalText(500),
});

export const paymentStatusSchema = z.object({
  payment_id: uuid,
  status: z.enum(["pending", "verified", "approved", "paid"]),
  reference: optionalText(120),
});

// --- User provisioning (PRD §40) -------------------------------------------

export const userSchema = z.object({
  id: optionalUuid,
  full_name: trimmed(3, 120, "Nama lengkap"),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email("Format email tidak valid")),
  phone: optionalText(24),
  employee_id: optionalText(40),
  position: optionalText(80),
  primary_hotel_id: uuid,
  department_id: optionalUuid,
  role_code: z.enum([
    "super_admin",
    "hr_admin",
    "general_manager",
    "finance",
    "hod",
    "supervisor",
    "viewer",
    "casual_worker",
  ]),
  hotel_ids: z.array(uuid).min(1, "Pilih minimal satu unit hotel"),
  status: z.enum(["pending", "active", "inactive", "suspended"]).default("active"),
});

// --- Settings ---------------------------------------------------------------

export const hotelSchema = z.object({
  id: optionalUuid,
  code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, "Kode hotel 2-10 huruf/angka kapital")),
  name: trimmed(3, 160, "Nama hotel"),
  address: optionalText(300),
  city: optionalText(80),
  phone: optionalText(24),
  email: optionalText(120),
  timezone: z.string().default("Asia/Jakarta"),
  currency: z.string().length(3).default("IDR"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geofence_radius_m: z.coerce.number().int().min(10).max(5000).default(150),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const departmentSchema = z.object({
  id: optionalUuid,
  hotel_id: uuid,
  code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().min(2).max(10)),
  name: trimmed(2, 80, "Nama department"),
  // Checkboxes post "on" or nothing at all; z.coerce.boolean() would read the
  // string "false" as true, so the mapping is explicit.
  is_active: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
});

export const rateSchema = z.object({
  id: optionalUuid,
  hotel_id: uuid,
  department_id: optionalUuid,
  position: trimmed(2, 80, "Posisi"),
  rate_type: z.enum(["daily", "hourly"]),
  rate: money,
  overtime_rate: money.default(0),
  meal_allowance: money.default(0),
  transport_allowance: money.default(0),
  effective_from: isoDate,
  effective_to: isoDate.optional().or(z.literal("").transform(() => undefined)),
});

export const approvalRuleSchema = z
  .object({
    id: optionalUuid,
    hotel_id: uuid,
    name: trimmed(3, 120, "Nama aturan"),
    min_amount: money,
    max_amount: money.optional().or(z.literal("").transform(() => undefined)),
    steps: z.array(z.enum(["hod", "hr", "finance", "gm"])).min(1, "Pilih minimal satu tahap"),
  })
  .refine((v) => v.max_amount === undefined || v.max_amount >= v.min_amount, {
    message: "Batas atas harus lebih besar dari batas bawah",
    path: ["max_amount"],
  });

export const budgetSchema = z.object({
  id: optionalUuid,
  hotel_id: uuid,
  department_id: optionalUuid,
  period_year: z.coerce.number().int().min(2000).max(2200),
  period_month: z.coerce.number().int().min(1).max(12),
  amount: money,
  notes: optionalText(300),
});

/** Turns a ZodError into the fieldErrors shape our forms expect. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
