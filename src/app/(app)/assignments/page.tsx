import type { Metadata } from "next";
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { AssignPanel } from "@/app/(app)/assignments/assign-panel";
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  formatDate,
  formatMoney,
  formatTime,
} from "@/lib/format";
import type { AssignmentRow, CasualRow, RequestListRow } from "@/types/domain";

export const metadata: Metadata = { title: "Assignment" };
export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; request?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();
  const canManage = can(ctx, "assignment.manage");

  let requestQuery = supabase
    .from("v_request_list")
    .select("*")
    .eq("hotel_id", hotel.id)
    .in("status", ["approved", "assigned", "in_progress"]);

  if (params.request) requestQuery = requestQuery.eq("id", params.request);
  if (params.from) requestQuery = requestQuery.gte("work_date", params.from);
  if (params.to) requestQuery = requestQuery.lte("work_date", params.to);
  if (params.status === "incomplete") requestQuery = requestQuery.gt("remaining_count", 0);
  if (params.status === "complete") requestQuery = requestQuery.eq("remaining_count", 0);

  const { data: requests } = await requestQuery
    .order("work_date", { ascending: true })
    .limit(50)
    .returns<RequestListRow[]>();

  const requestList = requests ?? [];
  const requestIds = requestList.map((r) => r.id);

  const [{ data: assignments }, { data: pool }] = await Promise.all([
    requestIds.length > 0
      ? supabase
          .from("v_assignment_detail")
          .select("*")
          .in("request_id", requestIds)
          .returns<AssignmentRow[]>()
      : Promise.resolve({ data: [] as AssignmentRow[] }),
    canManage
      ? supabase
          .from("v_casual_directory")
          .select("*")
          .eq("hotel_id", hotel.id)
          .eq("status", "active")
          .order("avg_rating", { ascending: false })
          .limit(300)
          .returns<CasualRow[]>()
      : Promise.resolve({ data: [] as CasualRow[] }),
  ]);

  const byRequest = new Map<string, AssignmentRow[]>();
  for (const a of assignments ?? []) {
    const list = byRequest.get(a.request_id) ?? [];
    list.push(a);
    byRequest.set(a.request_id, list);
  }

  return (
    <>
      <PageHeader
        title="Casual Assignment"
        description="Alokasikan casual dari talent pool ke request yang sudah disetujui. Casual dalam blacklist tidak dapat dipilih."
      />

      <FilterBar
        filters={[
          { name: "from", label: "Tanggal kerja dari", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
          {
            name: "status",
            label: "Kelengkapan",
            type: "select",
            options: [
              { value: "", label: "Semua" },
              { value: "incomplete", label: "Belum terpenuhi" },
              { value: "complete", label: "Sudah terpenuhi" },
            ],
          },
        ]}
      />

      {requestList.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCheck size={26} />}
            title="Tidak ada request yang siap di-assign"
            description="Request harus berstatus Disetujui sebelum casual dapat dialokasikan."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {requestList.map((r) => {
            const rows = byRequest.get(r.id) ?? [];
            const activeCount = rows.filter((a) => a.status !== "cancelled").length;
            return (
              <Card key={r.id}>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/requests/${r.id}`} className="text-primary hover:underline">
                        {r.request_no}
                      </Link>
                      <Badge tone={REQUEST_STATUS_TONE[r.status]}>
                        {REQUEST_STATUS_LABEL[r.status]}
                      </Badge>
                    </span>
                  }
                  description={`${r.department_name} · ${r.position_required} · ${formatDate(
                    r.work_date,
                  )} ${formatTime(r.start_time)}–${formatTime(r.end_time)} · ${formatMoney(
                    r.estimated_cost,
                    hotel.currency,
                  )}`}
                />
                <div className="p-5">
                  <AssignPanel
                    requestId={r.id}
                    requestNo={r.request_no}
                    required={r.qty_required}
                    assigned={activeCount}
                    pool={pool ?? []}
                    currentAssignments={rows}
                    currency={hotel.currency}
                    canManage={canManage}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
