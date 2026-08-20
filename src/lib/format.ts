import type {
  AssignmentStatus,
  AttendanceStatus,
  PaymentStatus,
  RequestStatus,
  TalentClass,
} from "@/types/domain";

export function formatMoney(value: number | null | undefined, currency = "IDR"): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID").format(Number(value ?? 0));
}

export function formatDate(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function formatTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  // Plain "HH:MM:SS" columns come back without a date part.
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function formatDuration(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes ?? 0)));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}j`;
  return `${h}j ${rest}m`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Today in a given IANA timezone, as YYYY-MM-DD. */
export function todayIn(timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function monthRange(timeZone = "Asia/Jakarta"): { from: string; to: string } {
  const today = todayIn(timeZone);
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

// --- Label + tone maps ------------------------------------------------------

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Diajukan",
  hod_approval: "Approval HOD",
  hr_review: "Review HR",
  finance_verification: "Verifikasi Finance",
  gm_approval: "Approval GM",
  approved: "Disetujui",
  assigned: "Sudah Assign",
  in_progress: "Berjalan",
  completed: "Selesai",
  closed: "Ditutup",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
  returned: "Dikembalikan",
};

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  draft: "neutral",
  submitted: "info",
  hod_approval: "warning",
  hr_review: "warning",
  finance_verification: "warning",
  gm_approval: "warning",
  approved: "success",
  assigned: "primary",
  in_progress: "primary",
  completed: "success",
  closed: "neutral",
  rejected: "danger",
  cancelled: "neutral",
  returned: "warning",
};

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  scheduled: "Terjadwal",
  present: "Hadir",
  late: "Terlambat",
  absent: "Tidak Hadir",
  no_show: "No Show",
  sick: "Sakit",
  permission: "Izin",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, Tone> = {
  scheduled: "neutral",
  present: "success",
  late: "warning",
  absent: "danger",
  no_show: "danger",
  sick: "info",
  permission: "info",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Ditugaskan",
  confirmed: "Dikonfirmasi",
  present: "Hadir",
  absent: "Tidak Hadir",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  verified: "Terverifikasi",
  approved: "Disetujui",
  paid: "Dibayar",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  pending: "warning",
  verified: "info",
  approved: "primary",
  paid: "success",
};

export const TALENT_CLASS_LABEL: Record<TalentClass, string> = {
  new: "Baru",
  available: "Tersedia",
  recommended: "Direkomendasikan",
  on_review: "Perlu Evaluasi",
  do_not_assign: "Jangan Ditugaskan",
};

export const TALENT_CLASS_TONE: Record<TalentClass, Tone> = {
  new: "info",
  available: "neutral",
  recommended: "success",
  on_review: "warning",
  do_not_assign: "danger",
};

export const APPROVAL_STEP_LABEL: Record<string, string> = {
  hod: "Department Head",
  hr: "HR Review",
  finance: "Finance Verification",
  gm: "General Manager",
};

/** PRD §34 rating classification. */
export function ratingLabel(rating: number): { label: string; tone: Tone } {
  if (rating >= 4.5) return { label: "Excellent", tone: "success" };
  if (rating >= 4.0) return { label: "Very Good", tone: "success" };
  if (rating >= 3.5) return { label: "Good", tone: "primary" };
  if (rating >= 3.0) return { label: "Average", tone: "warning" };
  if (rating > 0) return { label: "Needs Review", tone: "danger" };
  return { label: "Belum dinilai", tone: "neutral" };
}
