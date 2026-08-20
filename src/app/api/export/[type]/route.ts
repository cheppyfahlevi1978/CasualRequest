import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, can } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * CSV export honouring the same filters as the screen it was launched from
 * (PRD §36). Every query runs through the caller's session client, so an
 * export can never widen what the user is allowed to see.
 */

type Column = { key: string; header: string };

const DEFINITIONS: Record<
  string,
  { view: string; columns: Column[]; permission: string; dateColumn: string }
> = {
  requests: {
    view: "v_request_list",
    permission: "report.export",
    dateColumn: "work_date",
    columns: [
      { key: "request_no", header: "Request ID" },
      { key: "request_date", header: "Tanggal Pengajuan" },
      { key: "hotel_code", header: "Hotel" },
      { key: "department_name", header: "Department" },
      { key: "requester_name", header: "Requester" },
      { key: "position_required", header: "Posisi" },
      { key: "request_type", header: "Tipe" },
      { key: "event_name", header: "Event" },
      { key: "work_date", header: "Tanggal Kerja" },
      { key: "start_time", header: "Mulai" },
      { key: "end_time", header: "Selesai" },
      { key: "qty_required", header: "Qty Diminta" },
      { key: "assigned_count", header: "Qty Assigned" },
      { key: "rate", header: "Rate" },
      { key: "estimated_cost", header: "Estimasi Biaya" },
      { key: "status", header: "Status" },
      { key: "reason", header: "Alasan" },
    ],
  },
  attendance: {
    view: "v_assignment_detail",
    permission: "report.export",
    dateColumn: "work_date",
    columns: [
      { key: "work_date", header: "Tanggal" },
      { key: "request_no", header: "Request ID" },
      { key: "casual_no", header: "Casual ID" },
      { key: "casual_name", header: "Nama Casual" },
      { key: "department_name", header: "Department" },
      { key: "shift_name", header: "Shift" },
      { key: "check_in", header: "Check-in" },
      { key: "check_out", header: "Check-out" },
      { key: "working_minutes", header: "Menit Kerja" },
      { key: "overtime_minutes", header: "Menit Lembur" },
      { key: "attendance_status", header: "Status" },
    ],
  },
  casuals: {
    view: "v_casual_directory",
    permission: "report.export",
    dateColumn: "join_date",
    columns: [
      { key: "casual_no", header: "Casual ID" },
      { key: "full_name", header: "Nama" },
      { key: "gender", header: "Gender" },
      { key: "phone", header: "Telepon" },
      { key: "email", header: "Email" },
      { key: "preferred_department_name", header: "Department" },
      { key: "hotel_experience_years", header: "Pengalaman (thn)" },
      { key: "status", header: "Status" },
      { key: "talent_class", header: "Klasifikasi" },
      { key: "avg_rating", header: "Rating" },
      { key: "attendance_rate", header: "Kehadiran %" },
      { key: "total_assignment", header: "Total Assignment" },
      { key: "last_assignment_date", header: "Assignment Terakhir" },
    ],
  },
  payments: {
    view: "payments",
    permission: "report.export",
    dateColumn: "work_date",
    columns: [
      { key: "work_date", header: "Tanggal" },
      { key: "casual_id", header: "Casual" },
      { key: "rate_type", header: "Tipe Rate" },
      { key: "rate", header: "Rate" },
      { key: "worked_hours", header: "Jam Kerja" },
      { key: "overtime_hours", header: "Jam Lembur" },
      { key: "basic_amount", header: "Basic" },
      { key: "allowance", header: "Allowance" },
      { key: "overtime_amount", header: "Overtime" },
      { key: "deduction", header: "Deduction" },
      { key: "total_amount", header: "Total" },
      { key: "status", header: "Status" },
      { key: "payment_reference", header: "Referensi" },
    ],
  },
};

/** RFC 4180 quoting, plus the guard against spreadsheet formula injection. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n,;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const { type } = await context.params;
  const definition = DEFINITIONS[type];

  if (!definition) {
    return NextResponse.json({ error: "Jenis export tidak dikenal" }, { status: 404 });
  }

  const ctx = await getSessionContext();
  if (!ctx || ctx.profile.status !== "active" || !ctx.activeHotel) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  if (!can(ctx, definition.permission)) {
    return NextResponse.json({ error: "Tidak memiliki izin export" }, { status: 403 });
  }

  const p = request.nextUrl.searchParams;
  const supabase = await createClient();

  let query = supabase
    .from(definition.view)
    .select(definition.columns.map((c) => c.key).join(","))
    .eq("hotel_id", ctx.activeHotel.id);

  if (p.get("status")) query = query.eq("status", p.get("status")!);
  if (p.get("department")) query = query.eq("department_id", p.get("department")!);
  if (p.get("date")) query = query.eq(definition.dateColumn, p.get("date")!);
  if (p.get("from")) query = query.gte(definition.dateColumn, p.get("from")!);
  if (p.get("to")) query = query.lte(definition.dateColumn, p.get("to")!);
  if (p.get("scope") === "mine") query = query.eq("requester_id", ctx.userId);

  // Hard ceiling: a browser download, not a data dump.
  const { data, error } = await query.limit(10_000);

  if (error) {
    return NextResponse.json({ error: "Data tidak dapat diexport saat ini." }, { status: 502 });
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const lines = [
    definition.columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row) => definition.columns.map((c) => csvCell(row[c.key])).join(",")),
  ];

  await supabase.from("activity_logs").insert({
    user_id: ctx.userId,
    hotel_id: ctx.activeHotel.id,
    action: "EXPORT_REPORT",
    module: "reports",
    record_id: type,
    description: `Exported ${rows.length} ${type} rows to CSV`,
    metadata: Object.fromEntries(p.entries()),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens UTF-8 correctly (PRD §36 "Excel-compatible CSV").
  const body = `﻿${lines.join("\r\n")}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casual-request-${type}-${ctx.activeHotel.code}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
