import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  Pagination,
  Table,
  TableWrap,
  Td,
  Th,
  buttonClass,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  formatDate,
  formatMoney,
  formatNumber,
} from "@/lib/format";
import type { Department, RequestListRow, RequestStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Request" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua status" },
  ...(
    [
      "draft",
      "submitted",
      "hod_approval",
      "hr_review",
      "finance_verification",
      "gm_approval",
      "approved",
      "assigned",
      "in_progress",
      "completed",
      "closed",
      "rejected",
      "cancelled",
      "returned",
    ] as RequestStatus[]
  ).map((s) => ({ value: s, label: REQUEST_STATUS_LABEL[s] })),
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    department?: string;
    from?: string;
    to?: string;
    q?: string;
    scope?: string;
  }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const readsAll = can(ctx, "request.read_all");
  const scope = params.scope ?? (readsAll ? "all" : "mine");

  let query = supabase
    .from("v_request_list")
    .select("*", { count: "exact" })
    .eq("hotel_id", hotel.id);

  if (scope === "mine") query = query.eq("requester_id", ctx.userId);
  if (params.status) query = query.eq("status", params.status);
  if (params.department) query = query.eq("department_id", params.department);
  if (params.from) query = query.gte("work_date", params.from);
  if (params.to) query = query.lte("work_date", params.to);
  if (params.q) {
    const term = `%${params.q.replace(/[%_]/g, "")}%`;
    query = query.or(
      `request_no.ilike.${term},position_required.ilike.${term},event_name.ilike.${term}`,
    );
  }

  const [{ data, count, error }, { data: departments }] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      .returns<RequestListRow[]>(),
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<Department[]>(),
  ]);

  const rows = data ?? [];
  const qs = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][],
  );

  return (
    <>
      <PageHeader
        title={scope === "mine" ? "Request Saya" : "Daftar Request"}
        description="Seluruh pengajuan casual beserta progres approval-nya."
        actions={
          <>
            {readsAll ? (
              <Link
                href={
                  scope === "mine"
                    ? `/requests?${new URLSearchParams({ ...Object.fromEntries(qs), scope: "all" })}`
                    : `/requests?${new URLSearchParams({ ...Object.fromEntries(qs), scope: "mine" })}`
                }
                className={buttonClass("secondary", "sm")}
              >
                {scope === "mine" ? "Lihat semua department" : "Hanya request saya"}
              </Link>
            ) : null}
            {can(ctx, "report.export") ? (
              <a
                href={`/api/export/requests?${qs.toString()}&scope=${scope}`}
                className={buttonClass("secondary", "sm")}
              >
                Export CSV
              </a>
            ) : null}
            {can(ctx, "request.create") ? (
              <LinkButton href="/requests/new" size="sm">
                Buat Request
              </LinkButton>
            ) : null}
          </>
        }
      />

      <FilterBar
        filters={[
          { name: "q", label: "Cari", type: "text", placeholder: "No. request / posisi / event" },
          { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
          {
            name: "department",
            label: "Department",
            type: "select",
            options: [
              { value: "", label: "Semua department" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ],
          },
          { name: "from", label: "Tanggal kerja dari", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
        ]}
      />

      {error ? (
        <div className="cr-card p-6 text-sm text-danger">
          Data tidak dapat dimuat saat ini. Silakan muat ulang halaman.
        </div>
      ) : rows.length === 0 ? (
        <div className="cr-card">
          <EmptyState
            icon={<FileText size={26} />}
            title="Belum ada request"
            description="Request yang Anda buat atau yang berada dalam cakupan akses Anda akan tampil di sini."
            action={
              can(ctx, "request.create") ? (
                <LinkButton href="/requests/new" size="sm">
                  Buat request pertama
                </LinkButton>
              ) : null
            }
          />
        </div>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Request ID</Th>
                <Th>Department</Th>
                <Th>Tanggal Kerja</Th>
                <Th>Posisi</Th>
                <Th align="center">Qty</Th>
                <Th align="right">Estimasi Biaya</Th>
                <Th>Status</Th>
                <Th>Progres</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const stepCount = r.approval_steps?.length ?? 0;
                const done = r.status === "approved" ? stepCount : Math.max(r.approval_level - 1, 0);
                return (
                  <tr key={r.id} className="transition hover:bg-bg-subtle">
                    <Td>
                      <Link
                        href={`/requests/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.request_no}
                      </Link>
                      <p className="text-xs text-text-faint">{formatDate(r.request_date)}</p>
                    </Td>
                    <Td>
                      <p>{r.department_name}</p>
                      <p className="text-xs text-text-faint">{r.requester_name}</p>
                    </Td>
                    <Td>{formatDate(r.work_date)}</Td>
                    <Td>
                      <p>{r.position_required}</p>
                      {r.event_name ? (
                        <p className="text-xs text-text-faint">{r.event_name}</p>
                      ) : null}
                    </Td>
                    <Td align="center">
                      {formatNumber(r.assigned_count)}/{formatNumber(r.qty_required)}
                    </Td>
                    <Td align="right">{formatMoney(r.estimated_cost, hotel.currency)}</Td>
                    <Td>
                      <Badge tone={REQUEST_STATUS_TONE[r.status]}>
                        {REQUEST_STATUS_LABEL[r.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {stepCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {r.approval_steps.map((s, i) => (
                            <span
                              key={s + i}
                              title={s.toUpperCase()}
                              className={`h-1.5 w-6 rounded-full ${
                                i < done ? "bg-success" : i === done ? "bg-warning" : "bg-border"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-[11px] text-text-faint">
                            {done}/{stepCount}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-faint">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/requests/${r.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Detail
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? rows.length}
            baseHref={`/requests?${qs.toString()}`}
          />
        </TableWrap>
      )}
    </>
  );
}
