import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, RotateCcw, X, Minus } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Td,
  Th,
} from "@/components/ui/primitives";
import { RequestActions } from "@/app/(app)/requests/[id]/request-actions";
import {
  APPROVAL_STEP_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
} from "@/lib/format";
import type { AssignmentRow, RequestApproval, RequestListRow } from "@/types/domain";

export const metadata: Metadata = { title: "Detail Request" };
export const dynamic = "force-dynamic";

const DECISION_ICON = {
  approved: Check,
  rejected: X,
  returned: RotateCcw,
  pending: Clock,
  skipped: Minus,
} as const;

const DECISION_TONE = {
  approved: "success",
  rejected: "danger",
  returned: "warning",
  pending: "neutral",
  skipped: "neutral",
} as const;

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("v_request_list")
    .select("*")
    .eq("id", id)
    .maybeSingle<RequestListRow>();

  if (!request) notFound();

  const [{ data: approvals }, { data: assignments }] = await Promise.all([
    supabase
      .from("request_approvals")
      .select("*")
      .eq("request_id", id)
      .order("step_order")
      .returns<RequestApproval[]>(),
    supabase
      .from("v_assignment_detail")
      .select("*")
      .eq("request_id", id)
      .order("casual_name")
      .returns<AssignmentRow[]>(),
  ]);

  const approverNames = await loadApproverNames(approvals ?? []);
  const isOwner = request.requester_id === ctx.userId;
  const currency = ctx.activeHotel?.currency ?? "IDR";

  return (
    <>
      <PageHeader
        title={request.request_no}
        description={`${request.department_name} · ${request.position_required} · ${formatDate(request.work_date)}`}
        actions={
          <RequestActions
            requestId={request.id}
            canSubmit={(isOwner || can(ctx, "request.update_all")) &&
              ["draft", "returned"].includes(request.status)}
            canCancel={
              (isOwner || can(ctx, "request.update_all")) &&
              !["completed", "closed", "cancelled"].includes(request.status)
            }
            canClose={can(ctx, "request.close") && request.status === "completed"}
            canDuplicate={can(ctx, "request.create")}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Badge tone={REQUEST_STATUS_TONE[request.status]}>
          {REQUEST_STATUS_LABEL[request.status]}
        </Badge>
        {request.current_step ? (
          <span className="text-xs text-text-muted">
            Menunggu: <strong className="text-text">{APPROVAL_STEP_LABEL[request.current_step]}</strong>
          </span>
        ) : null}
        <span className="text-xs text-text-muted">
          Diajukan oleh <strong className="text-text">{request.requester_name}</strong>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Informasi Request" />
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Hotel" value={`${request.hotel_code} — ${request.hotel_name}`} />
              <Detail label="Tanggal Pengajuan" value={formatDate(request.request_date)} />
              <Detail label="Department" value={request.department_name} />
              <Detail
                label="Tipe"
                value={request.request_type === "event" ? `Event — ${request.event_name}` : "Operational"}
              />
              <Detail label="Tanggal Kerja" value={formatDate(request.work_date)} />
              <Detail
                label="Jam Kerja"
                value={`${formatTime(request.start_time)} – ${formatTime(request.end_time)} (${request.estimated_hours} jam)`}
              />
              <Detail label="Jumlah Dibutuhkan" value={`${formatNumber(request.qty_required)} casual`} />
              <Detail label="Rate per Casual" value={formatMoney(request.rate, currency)} />
              <Detail
                label="Estimasi Biaya"
                value={formatMoney(request.estimated_cost, currency)}
                emphasis
              />
              <Detail label="Lokasi" value={request.location ?? "—"} />
              <Detail label="Alasan" value={request.reason} className="sm:col-span-2 lg:col-span-3" />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Casual Assigned"
              description={`${request.assigned_count} dari ${request.qty_required} terpenuhi · sisa ${request.remaining_count}`}
              action={
                can(ctx, "assignment.manage") && request.remaining_count > 0 ? (
                  <Link
                    href={`/assignments?request=${request.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Kelola assignment
                  </Link>
                ) : null
              }
            />
            {(assignments ?? []).length === 0 ? (
              <EmptyState
                title="Belum ada casual yang dialokasikan"
                description="Assignment dapat dilakukan setelah request disetujui."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Casual</Th>
                      <Th>Shift</Th>
                      <Th align="right">Rate</Th>
                      <Th>Status</Th>
                      <Th>Absensi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assignments ?? []).map((a) => (
                      <tr key={a.id}>
                        <Td>
                          <p className="font-medium">{a.casual_name}</p>
                          <p className="text-xs text-text-faint">{a.casual_no}</p>
                        </Td>
                        <Td>{a.shift_name ?? "—"}</Td>
                        <Td align="right">{formatMoney(a.rate, currency)}</Td>
                        <Td>
                          <Badge tone={a.status === "cancelled" ? "neutral" : "primary"}>
                            {ASSIGNMENT_STATUS_LABEL[a.status]}
                          </Badge>
                        </Td>
                        <Td>
                          {a.check_in ? (
                            <span className="text-xs">
                              {formatTime(a.check_in)}
                              {a.check_out ? ` – ${formatTime(a.check_out)}` : " – berjalan"}
                            </span>
                          ) : (
                            <span className="text-xs text-text-faint">Belum check-in</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Approval timeline — PRD §15 */}
        <Card className="h-fit">
          <CardHeader title="Riwayat Approval" description="Setiap langkah tercatat lengkap" />
          <div className="p-5">
            <ol className="relative space-y-5 border-l border-border pl-6">
              <TimelineItem
                tone="primary"
                title="Diajukan"
                who={request.requester_name}
                when={request.submitted_at ?? request.created_at}
                note={request.submitted_at ? undefined : "Masih berstatus draft"}
              />
              {(approvals ?? []).map((a) => {
                const Icon = DECISION_ICON[a.decision];
                return (
                  <TimelineItem
                    key={a.id}
                    tone={DECISION_TONE[a.decision]}
                    icon={<Icon size={11} />}
                    title={APPROVAL_STEP_LABEL[a.step] ?? a.step}
                    who={
                      a.approver_id
                        ? (approverNames[a.approver_id] ?? a.approver_email ?? "—")
                        : "Menunggu keputusan"
                    }
                    when={a.decided_at}
                    note={a.remark ?? undefined}
                    status={a.decision}
                  />
                );
              })}
              {(approvals ?? []).length === 0 ? (
                <li className="text-xs text-text-faint">
                  Alur approval dibentuk saat request diajukan, mengikuti aturan threshold biaya.
                </li>
              ) : null}
            </ol>
          </div>
        </Card>
      </div>
    </>
  );
}

async function loadApproverNames(approvals: RequestApproval[]): Promise<Record<string, string>> {
  const ids = [...new Set(approvals.map((a) => a.approver_id).filter(Boolean))] as string[];
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids)
    .returns<{ id: string; full_name: string }[]>();
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
}

function Detail({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className={emphasis ? "mt-0.5 text-base font-semibold text-primary" : "mt-0.5 text-sm text-text"}>
        {value}
      </dd>
    </div>
  );
}

function TimelineItem({
  title,
  who,
  when,
  note,
  tone,
  icon,
  status,
}: {
  title: string;
  who: string;
  when?: string | null;
  note?: string;
  tone: "primary" | "success" | "danger" | "warning" | "neutral";
  icon?: React.ReactNode;
  status?: string;
}) {
  const dot: Record<string, string> = {
    primary: "bg-primary text-primary-fg",
    success: "bg-success text-white",
    danger: "bg-danger text-white",
    warning: "bg-warning text-white",
    neutral: "bg-border text-text-muted",
  };

  return (
    <li className="relative">
      <span
        className={`absolute -left-[1.9rem] grid h-5 w-5 place-items-center rounded-full ${dot[tone]}`}
      >
        {icon ?? <Check size={11} />}
      </span>
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="text-xs text-text-muted">{who}</p>
      {when ? <p className="mt-0.5 text-[11px] text-text-faint">{formatDateTime(when)}</p> : null}
      {note ? (
        <p className="mt-1 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-[11px] text-text-muted">
          {note}
        </p>
      ) : null}
      {status && status !== "pending" ? (
        <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-text-faint">
          {status}
        </span>
      ) : null}
    </li>
  );
}
