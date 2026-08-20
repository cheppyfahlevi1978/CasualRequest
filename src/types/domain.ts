/**
 * Application-level row shapes.
 *
 * These mirror the SQL schema in supabase/migrations. Run `npm run db:types`
 * once a project is linked to regenerate a fully derived version into
 * src/types/database.types.ts; these hand-written types are what the UI codes
 * against so the app stays buildable before a project exists.
 */

export type UserStatus = "pending" | "active" | "inactive" | "suspended";
export type HotelStatus = "active" | "inactive";
export type Gender = "male" | "female";
export type RequestType = "operational" | "event";

export type RequestStatus =
  | "draft"
  | "submitted"
  | "hod_approval"
  | "hr_review"
  | "finance_verification"
  | "gm_approval"
  | "approved"
  | "assigned"
  | "in_progress"
  | "completed"
  | "closed"
  | "rejected"
  | "cancelled"
  | "returned";

export type ApprovalStep = "hod" | "hr" | "finance" | "gm";
export type ApprovalDecision = "pending" | "approved" | "rejected" | "returned" | "skipped";
export type AssignmentStatus =
  | "assigned"
  | "confirmed"
  | "present"
  | "absent"
  | "completed"
  | "cancelled";
export type AttendanceStatus =
  | "scheduled"
  | "present"
  | "late"
  | "absent"
  | "no_show"
  | "sick"
  | "permission";
export type PaymentStatus = "pending" | "verified" | "approved" | "paid";
export type CasualStatus = "active" | "inactive" | "blacklisted";
export type TalentClass = "new" | "available" | "recommended" | "on_review" | "do_not_assign";
export type RateType = "daily" | "hourly";
export type DocumentType =
  | "ktp"
  | "cv"
  | "certificate"
  | "agreement"
  | "warning_letter"
  | "photo"
  | "attendance_evidence"
  | "request_attachment"
  | "other";

export interface Hotel {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  timezone: string;
  currency: string;
  status: HotelStatus;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
}

export interface Department {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  employee_id: string | null;
  position: string | null;
  photo_path: string | null;
  primary_hotel_id: string | null;
  department_id: string | null;
  status: UserStatus;
  locale: "id" | "en";
  theme: "light" | "dark" | "system";
  notify_email: boolean;
  notify_inapp: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_active: boolean;
}

export interface RateMaster {
  id: string;
  hotel_id: string;
  department_id: string | null;
  position: string;
  rate_type: RateType;
  rate: number;
  overtime_rate: number;
  meal_allowance: number;
  transport_allowance: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface ApprovalRule {
  id: string;
  hotel_id: string;
  name: string;
  min_amount: number;
  max_amount: number | null;
  steps: ApprovalStep[];
  is_active: boolean;
  sort_order: number;
}

/** Row of public.v_request_list. */
export interface RequestListRow {
  id: string;
  request_no: string;
  hotel_id: string;
  hotel_code: string;
  hotel_name: string;
  department_id: string;
  department_name: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  request_date: string;
  work_date: string;
  start_time: string;
  end_time: string;
  shift_id: string | null;
  position_required: string;
  request_type: RequestType;
  event_name: string | null;
  qty_required: number;
  rate: number;
  estimated_hours: number;
  estimated_cost: number;
  status: RequestStatus;
  approval_steps: ApprovalStep[];
  approval_level: number;
  reason: string;
  location: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  assigned_count: number;
  remaining_count: number;
  current_step: ApprovalStep | null;
}

export interface RequestApproval {
  id: string;
  request_id: string;
  hotel_id: string;
  step: ApprovalStep;
  step_order: number;
  decision: ApprovalDecision;
  approver_id: string | null;
  approver_email: string | null;
  approver_role: string | null;
  remark: string | null;
  decided_at: string | null;
  created_at: string;
}

/** Row of public.v_assignment_detail. */
export interface AssignmentRow {
  id: string;
  request_id: string;
  request_no: string;
  hotel_id: string;
  department_id: string;
  department_name: string;
  casual_id: string;
  casual_no: string;
  casual_name: string;
  casual_phone: string | null;
  photo_path: string | null;
  avg_rating: number;
  work_date: string;
  shift_id: string | null;
  shift_name: string | null;
  shift_start: string | null;
  shift_end: string | null;
  rate: number;
  status: AssignmentStatus;
  attendance_id: string | null;
  check_in: string | null;
  check_out: string | null;
  working_minutes: number | null;
  overtime_minutes: number | null;
  attendance_status: AttendanceStatus | null;
  evaluation_id: string | null;
  final_rating: number | null;
  payment_id: string | null;
  payment_status: PaymentStatus | null;
  total_amount: number | null;
}

/** Row of public.v_casual_directory. */
export interface CasualRow {
  id: string;
  casual_no: string;
  hotel_id: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  gender: Gender | null;
  address: string | null;
  skills: string[];
  preferred_department_id: string | null;
  preferred_department_name: string | null;
  hotel_experience_years: number;
  photo_path: string | null;
  thumb_path: string | null;
  status: CasualStatus;
  talent_class: TalentClass;
  avg_rating: number;
  attendance_rate: number;
  total_assignment: number;
  last_assignment_date: string | null;
  join_date: string;
  is_blacklisted: boolean;
}

export interface PaymentRow {
  id: string;
  assignment_id: string;
  request_id: string;
  casual_id: string;
  hotel_id: string;
  department_id: string;
  work_date: string;
  rate_type: RateType;
  rate: number;
  worked_hours: number;
  overtime_hours: number;
  basic_amount: number;
  allowance: number;
  overtime_amount: number;
  deduction: number;
  total_amount: number;
  status: PaymentStatus;
  payment_reference: string | null;
}

export interface DocumentRow {
  id: string;
  hotel_id: string;
  casual_id: string | null;
  request_id: string | null;
  document_type: DocumentType;
  bucket_name: string;
  object_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  title: string | null;
  expires_at: string | null;
  is_private: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  hotel_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  hotel_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogRow {
  id: string;
  changed_at: string;
  changed_by: string | null;
  hotel_id: string | null;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_fields: string[] | null;
}

export interface EvaluationRow {
  id: string;
  assignment_id: string;
  casual_id: string;
  hotel_id: string;
  department_id: string;
  evaluator_id: string;
  score_attendance: number;
  score_discipline: number;
  score_attitude: number;
  score_grooming: number;
  score_skill: number;
  score_teamwork: number;
  score_communication: number;
  score_overall: number;
  final_rating: number;
  strength: string | null;
  improvement: string | null;
  recommendation: "rehire" | "consider" | "do_not_rehire" | null;
  created_at: string;
}

/** Shape returned by public.dashboard_summary(). */
export interface DashboardSummary {
  kpi: {
    total_request: number;
    pending_approval: number;
    approved: number;
    casual_needed: number;
    casual_assigned: number;
    casual_present_today: number;
    casual_absent_today: number;
    casual_cost: number;
    committed_cost: number;
    budget_amount: number;
    budget_remaining: number;
  };
  request_trend: { bucket: string; requests: number; qty: number }[];
  by_department: { department: string; requests: number; qty: number }[];
  by_status: { status: RequestStatus; total: number }[];
  cost_trend: { bucket: string; actual: number; budget: number }[];
  attendance_mix: { status: AttendanceStatus; total: number }[];
  top_casuals: {
    name: string;
    casual_no: string;
    assignments: number;
    rating: number;
    attendance_rate: number;
  }[];
}

export interface AnalyticsSummary {
  total_requests: number;
  total_qty: number;
  avg_qty_per_request: number;
  avg_approval_hours: number;
  attendance_rate: number;
  no_show_rate: number;
  total_spend: number;
  unpaid_amount: number;
  active_casuals: number;
}
