import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PrintTrigger } from "@/app/(app)/requests/[id]/print/print-trigger";
import {
  APPROVAL_STEP_LABEL,
  REQUEST_STATUS_LABEL,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
} from "@/lib/format";
import type { AssignmentRow, RequestApproval, RequestListRow } from "@/types/domain";

export const metadata: Metadata = { title: "Cetak Request" };
export const dynamic = "force-dynamic";

export default async function PrintRequestPage({
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

  const currency = ctx.activeHotel?.currency ?? "IDR";

  return (
    <div className="mx-auto max-w-3xl">
      <PrintTrigger />

      <div className="cr-card p-8">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
                {request.hotel_code}
              </span>
              <div>
                <p className="text-sm font-semibold text-text">{request.hotel_name}</p>
                <p className="text-xs text-text-muted">Casual Request Form</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-text">{request.request_no}</p>
            <p className="text-xs text-text-muted">{formatDate(request.request_date)}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
              {REQUEST_STATUS_LABEL[request.status]}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-3 py-5 text-sm">
          <Row label="Diajukan oleh" value={request.requester_name} />
          <Row label="Department" value={request.department_name} />
          <Row label="Posisi" value={request.position_required} />
          <Row
            label="Tipe"
            value={request.request_type === "event" ? `Event — ${request.event_name}` : "Operational"}
          />
          <Row label="Tanggal kerja" value={formatDate(request.work_date)} />
          <Row
            label="Jam kerja"
            value={`${formatTime(request.start_time)} – ${formatTime(request.end_time)}`}
          />
          <Row label="Jumlah casual" value={`${formatNumber(request.qty_required)} orang`} />
          <Row label="Lokasi" value={request.location ?? "—"} />
          <Row label="Rate per casual" value={formatMoney(request.rate, currency)} />
          <Row label="Estimasi biaya" value={formatMoney(request.estimated_cost, currency)} />
        </section>

        <section className="border-t border-border py-4 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Alasan kebutuhan
          </p>
          <p className="mt-1 text-text">{request.reason}</p>
        </section>

        <section className="border-t border-border py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Riwayat approval
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-1.5">Tahap</th>
                <th className="py-1.5">Approver</th>
                <th className="py-1.5">Waktu</th>
                <th className="py-1.5">Keputusan</th>
                <th className="py-1.5">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(approvals ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-1.5">{APPROVAL_STEP_LABEL[a.step] ?? a.step}</td>
                  <td className="py-1.5">{a.approver_email ?? "—"}</td>
                  <td className="py-1.5">{a.decided_at ? formatDateTime(a.decided_at) : "—"}</td>
                  <td className="py-1.5 uppercase">{a.decision}</td>
                  <td className="py-1.5">{a.remark ?? "—"}</td>
                </tr>
              ))}
              {(approvals ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-text-faint">
                    Belum diajukan untuk approval
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="border-t border-border py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Casual assigned ({(assignments ?? []).length})
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-1.5">No</th>
                <th className="py-1.5">Casual ID</th>
                <th className="py-1.5">Nama</th>
                <th className="py-1.5">Shift</th>
                <th className="py-1.5">Tanda tangan</th>
              </tr>
            </thead>
            <tbody>
              {(assignments ?? []).map((a, i) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2 font-mono">{a.casual_no}</td>
                  <td className="py-2">{a.casual_name}</td>
                  <td className="py-2">{a.shift_name ?? "—"}</td>
                  <td className="py-2" />
                </tr>
              ))}
              {(assignments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-text-faint">
                    Belum ada casual yang dialokasikan
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <footer className="mt-6 grid grid-cols-3 gap-6 border-t border-border pt-8 text-center text-xs text-text-muted">
          {["Requester", "HR Admin", "General Manager"].map((role) => (
            <div key={role}>
              <div className="mb-1 h-12 border-b border-border-strong" />
              {role}
            </div>
          ))}
        </footer>

        <p className="mt-6 text-center text-[10px] text-text-faint">
          Dicetak dari Casual Request pada {formatDateTime(new Date())} oleh {ctx.profile.full_name}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-text">{value}</p>
    </div>
  );
}
