import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  buttonClass,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { AttendanceControls } from "@/app/(app)/attendance/attendance-controls";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  formatDuration,
  formatNumber,
  formatTime,
  todayIn,
} from "@/lib/format";
import type { AssignmentRow, Department } from "@/types/domain";

export const metadata: Metadata = { title: "Absensi Casual" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; department?: string; status?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const date = params.date || todayIn(hotel.timezone);
  const canManage = can(ctx, "attendance.manage");

  let query = supabase
    .from("v_assignment_detail")
    .select("*")
    .eq("hotel_id", hotel.id)
    .eq("work_date", date)
    .neq("status", "cancelled");

  if (params.department) query = query.eq("department_id", params.department);
  if (params.status) query = query.eq("attendance_status", params.status);

  const [{ data: rows }, { data: departments }, { data: setting }] = await Promise.all([
    query.order("casual_name").returns<AssignmentRow[]>(),
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<Department[]>(),
    supabase
      .from("settings")
      .select("value")
      .eq("hotel_id", hotel.id)
      .eq("category", "attendance")
      .eq("key", "rules")
      .maybeSingle<{ value: { require_geolocation?: boolean } }>(),
  ]);

  const list = rows ?? [];
  const requireGeo = Boolean(setting?.value?.require_geolocation);

  const present = list.filter((r) => r.attendance_status === "present").length;
  const late = list.filter((r) => r.attendance_status === "late").length;
  const absent = list.filter((r) =>
    ["absent", "no_show"].includes(r.attendance_status ?? ""),
  ).length;
  const pending = list.filter((r) => !r.attendance_status || r.attendance_status === "scheduled")
    .length;

  return (
    <>
      <PageHeader
        title="Absensi Casual"
        description={`Pencatatan kehadiran untuk ${date}. Durasi kerja dan lembur dihitung di sisi server agar tidak dapat dimanipulasi dari browser.`}
        actions={
          can(ctx, "report.export") ? (
            <a
              href={`/api/export/attendance?date=${date}${params.department ? `&department=${params.department}` : ""}`}
              className={buttonClass("secondary", "sm")}
            >
              Export CSV
            </a>
          ) : null
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Hadir" value={formatNumber(present)} tone="success" />
        <KpiCard label="Terlambat" value={formatNumber(late)} tone="warning" />
        <KpiCard label="Tidak Hadir" value={formatNumber(absent)} tone="danger" />
        <KpiCard label="Belum Check-in" value={formatNumber(pending)} tone="neutral" />
      </section>

      <FilterBar
        filters={[
          { name: "date", label: "Tanggal", type: "date" },
          {
            name: "department",
            label: "Department",
            type: "select",
            options: [
              { value: "", label: "Semua department" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ],
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "", label: "Semua status" },
              ...Object.entries(ATTENDANCE_STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck size={26} />}
            title="Tidak ada casual terjadwal"
            description={`Belum ada assignment untuk ${date} pada filter yang dipilih.`}
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Casual</Th>
                <Th>Request</Th>
                <Th>Department</Th>
                <Th>Shift</Th>
                <Th align="center">Check-in</Th>
                <Th align="center">Check-out</Th>
                <Th align="center">Durasi</Th>
                <Th>Status</Th>
                {canManage ? <Th align="right">Aksi</Th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="transition hover:bg-bg-subtle">
                  <Td>
                    <p className="font-medium">{r.casual_name}</p>
                    <p className="text-xs text-text-faint">{r.casual_no}</p>
                  </Td>
                  <Td>
                    <Link
                      href={`/requests/${r.request_id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {r.request_no}
                    </Link>
                  </Td>
                  <Td>{r.department_name}</Td>
                  <Td>
                    {r.shift_name ? (
                      <span className="text-xs">
                        {r.shift_name}
                        <br />
                        <span className="text-text-faint">
                          {formatTime(r.shift_start)}–{formatTime(r.shift_end)}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td align="center">{r.check_in ? formatTime(r.check_in) : "—"}</Td>
                  <Td align="center">{r.check_out ? formatTime(r.check_out) : "—"}</Td>
                  <Td align="center">
                    {r.working_minutes ? formatDuration(r.working_minutes) : "—"}
                    {r.overtime_minutes ? (
                      <span className="block text-[11px] text-warning">
                        OT {formatDuration(r.overtime_minutes)}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={ATTENDANCE_STATUS_TONE[r.attendance_status ?? "scheduled"]}>
                      {ATTENDANCE_STATUS_LABEL[r.attendance_status ?? "scheduled"]}
                    </Badge>
                  </Td>
                  {canManage ? (
                    <Td align="right">
                      <AttendanceControls
                        assignmentId={r.id}
                        hasCheckIn={Boolean(r.check_in)}
                        hasCheckOut={Boolean(r.check_out)}
                        defaultBreak={60}
                        requireGeolocation={requireGeo}
                      />
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
