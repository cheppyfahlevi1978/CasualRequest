import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
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
import {
  GeneratePaymentsButton,
  PaymentRowActions,
} from "@/app/(app)/payments/payment-controls";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  formatDate,
  formatMoney,
  formatNumber,
  monthRange,
} from "@/lib/format";
import type { Department, PaymentRow } from "@/types/domain";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

interface JoinedPayment extends PaymentRow {
  casual_workers: { casual_no: string; full_name: string } | null;
  casual_requests: { request_no: string } | null;
  departments: { name: string } | null;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; department?: string }>;
}) {
  const ctx = await requirePermission("payment.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const canVerify = can(ctx, "payment.verify");
  const canPay = can(ctx, "payment.pay");
  const canGenerate = can(ctx, "payment.generate");

  const defaults = monthRange(hotel.timezone);
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;

  let query = supabase
    .from("payments")
    .select(
      "*, casual_workers(casual_no, full_name), casual_requests(request_no), departments(name)",
    )
    .eq("hotel_id", hotel.id)
    .gte("work_date", from)
    .lte("work_date", to);

  if (params.status) query = query.eq("status", params.status);
  if (params.department) query = query.eq("department_id", params.department);

  const [{ data }, { data: departments }, { data: readyRequests }] = await Promise.all([
    query.order("work_date", { ascending: false }).limit(500),
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<Department[]>(),
    canGenerate
      ? supabase
          .from("casual_requests")
          .select("id")
          .eq("hotel_id", hotel.id)
          .gte("work_date", from)
          .lte("work_date", to)
          .in("status", ["in_progress", "completed", "assigned"])
          .limit(100)
          .returns<{ id: string }[]>()
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const rows = (data ?? []) as unknown as JoinedPayment[];

  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  const unpaid = rows
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + Number(r.total_amount), 0);
  const paidCount = rows.filter((r) => r.status === "paid").length;

  const qs = new URLSearchParams({ from, to });
  if (params.status) qs.set("status", params.status);
  if (params.department) qs.set("department", params.department);

  return (
    <>
      <PageHeader
        title="Casual Payment"
        description="Perhitungan dibuat dari absensi yang tercatat. Nilai total dihitung oleh database, bukan oleh browser."
        actions={
          <>
            {canGenerate ? (
              <GeneratePaymentsButton requestIds={(readyRequests ?? []).map((r) => r.id)} />
            ) : null}
            {can(ctx, "report.export") ? (
              <a href={`/api/export/payments?${qs}`} className={buttonClass("secondary", "sm")}>
                Export CSV
              </a>
            ) : null}
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Periode" value={formatMoney(total, hotel.currency)} tone="primary" />
        <KpiCard label="Belum Dibayar" value={formatMoney(unpaid, hotel.currency)} tone="warning" />
        <KpiCard label="Baris Pembayaran" value={formatNumber(rows.length)} tone="info" />
        <KpiCard label="Sudah Dibayar" value={formatNumber(paidCount)} tone="success" />
      </section>

      <FilterBar
        filters={[
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "", label: "Semua status" },
              ...Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            name: "department",
            label: "Department",
            type: "select",
            options: [
              { value: "", label: "Semua department" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={26} />}
            title="Belum ada baris pembayaran"
            description={
              canGenerate
                ? "Gunakan tombol Generate untuk membuat perhitungan dari absensi yang sudah tercatat."
                : "Perhitungan dibuat oleh Finance atau HR setelah absensi lengkap."
            }
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Casual</Th>
                <Th>Request</Th>
                <Th>Department</Th>
                <Th align="center">Jam</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Allowance</Th>
                <Th align="right">Overtime</Th>
                <Th align="right">Potongan</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-bg-subtle">
                  <Td>{formatDate(r.work_date)}</Td>
                  <Td>
                    <p className="font-medium">{r.casual_workers?.full_name ?? "—"}</p>
                    <p className="text-xs text-text-faint">{r.casual_workers?.casual_no ?? ""}</p>
                  </Td>
                  <Td className="text-xs">{r.casual_requests?.request_no ?? "—"}</Td>
                  <Td>{r.departments?.name ?? "—"}</Td>
                  <Td align="center">
                    {Number(r.worked_hours).toFixed(1)}
                    {Number(r.overtime_hours) > 0 ? (
                      <span className="block text-[11px] text-warning">
                        +{Number(r.overtime_hours).toFixed(1)} OT
                      </span>
                    ) : null}
                  </Td>
                  <Td align="right">{formatMoney(r.rate, hotel.currency)}</Td>
                  <Td align="right">{formatMoney(r.allowance, hotel.currency)}</Td>
                  <Td align="right">{formatMoney(r.overtime_amount, hotel.currency)}</Td>
                  <Td align="right">{formatMoney(r.deduction, hotel.currency)}</Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(r.total_amount, hotel.currency)}
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[r.status]}>
                      {PAYMENT_STATUS_LABEL[r.status]}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <PaymentRowActions
                      paymentId={r.id}
                      status={r.status}
                      allowance={Number(r.allowance)}
                      deduction={Number(r.deduction)}
                      canVerify={canVerify}
                      canPay={canPay}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
