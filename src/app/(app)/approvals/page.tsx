import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  Table,
  TableWrap,
  Td,
  Th,
  buttonClass,
} from "@/components/ui/primitives";
import { DecisionButtons } from "@/app/(app)/approvals/decision-buttons";
import {
  APPROVAL_STEP_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  formatDate,
  formatMoney,
  formatNumber,
} from "@/lib/format";
import type { ApprovalStep, RequestListRow } from "@/types/domain";

export const metadata: Metadata = { title: "Approval" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const TABS = [
  { key: "waiting", label: "Menunggu Saya" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
  { key: "all", label: "Semua" },
] as const;

const STEP_STATUS: Record<ApprovalStep, string> = {
  hod: "hod_approval",
  hr: "hr_review",
  finance: "finance_verification",
  gm: "gm_approval",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; request?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const tab = (params.tab ?? "waiting") as (typeof TABS)[number]["key"];
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Which steps may this user act on? Drives both the query and the buttons.
  const mySteps = (["hod", "hr", "finance", "gm"] as ApprovalStep[]).filter((s) =>
    can(ctx, `approval.${s}`),
  );
  const isOverride = can(ctx, "approval.override");
  const actionableSteps = isOverride ? (["hod", "hr", "finance", "gm"] as ApprovalStep[]) : mySteps;

  let query = supabase
    .from("v_request_list")
    .select("*", { count: "exact" })
    .eq("hotel_id", hotel.id);

  if (tab === "waiting") {
    const statuses = actionableSteps.map((s) => STEP_STATUS[s]);
    query = statuses.length > 0 ? query.in("status", statuses) : query.eq("id", "");
    // A HOD only ever sees their own department's queue.
    if (!can(ctx, "request.read_all") && ctx.profile.department_id) {
      query = query.eq("department_id", ctx.profile.department_id);
    }
  } else if (tab === "approved") {
    query = query.in("status", ["approved", "assigned", "in_progress", "completed", "closed"]);
  } else if (tab === "rejected") {
    query = query.in("status", ["rejected", "cancelled"]);
  }

  if (params.request) query = query.eq("id", params.request);

  const { data, count } = await query
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .returns<RequestListRow[]>();

  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Approval Inbox"
        description="Setiap keputusan tercatat lengkap dengan pengguna, waktu, dan catatan. Tidak ada approval anonim."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/approvals?tab=${t.key}`}
            className={buttonClass(tab === t.key ? "primary" : "secondary", "sm")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {mySteps.length === 0 && !isOverride ? (
        <Card>
          <EmptyState
            icon={<CheckSquare size={26} />}
            title="Anda tidak memiliki tahap approval"
            description="Role Anda tidak ditugaskan pada tahap approval mana pun di unit hotel ini."
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckSquare size={26} />}
            title={tab === "waiting" ? "Tidak ada yang menunggu persetujuan" : "Belum ada data"}
            description={
              tab === "waiting"
                ? "Semua request pada cakupan Anda sudah diproses."
                : "Coba pilih tab lain untuk melihat riwayat approval."
            }
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Request ID</Th>
                <Th>Requester</Th>
                <Th>Department</Th>
                <Th>Tanggal Kerja</Th>
                <Th align="center">Qty</Th>
                <Th align="right">Estimasi Biaya</Th>
                <Th>Tahap</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actionable =
                  tab === "waiting" &&
                  r.current_step !== null &&
                  actionableSteps.includes(r.current_step) &&
                  r.requester_id !== ctx.userId;

                return (
                  <tr key={r.id} className="align-top transition hover:bg-bg-subtle">
                    <Td>
                      <Link
                        href={`/requests/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.request_no}
                      </Link>
                      <p className="text-xs text-text-faint">{r.position_required}</p>
                    </Td>
                    <Td>{r.requester_name}</Td>
                    <Td>{r.department_name}</Td>
                    <Td>{formatDate(r.work_date)}</Td>
                    <Td align="center">{formatNumber(r.qty_required)}</Td>
                    <Td align="right">{formatMoney(r.estimated_cost, hotel.currency)}</Td>
                    <Td>
                      {r.current_step ? (
                        <Badge tone="warning">{APPROVAL_STEP_LABEL[r.current_step]}</Badge>
                      ) : (
                        <Badge tone={REQUEST_STATUS_TONE[r.status]}>
                          {REQUEST_STATUS_LABEL[r.status]}
                        </Badge>
                      )}
                    </Td>
                    <Td align="right">
                      {actionable ? (
                        <DecisionButtons requestId={r.id} />
                      ) : (
                        <Link
                          href={`/requests/${r.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Detail
                        </Link>
                      )}
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
            baseHref={`/approvals?tab=${tab}`}
          />
        </TableWrap>
      )}
    </>
  );
}
