import type { Metadata } from "next";
import { Download, FileBarChart } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  PageHeader,
  Td,
  Th,
  buttonClass,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatMoney, formatNumber, monthRange } from "@/lib/format";
import type { DashboardSummary } from "@/types/domain";

export const metadata: Metadata = { title: "Laporan" };
export const dynamic = "force-dynamic";

const REPORTS = [
  { type: "requests", title: "Casual Request Report", blurb: "Seluruh pengajuan beserta status, qty, dan biaya." },
  { type: "attendance", title: "Attendance Report", blurb: "Check-in, check-out, durasi kerja, dan lembur." },
  { type: "casuals", title: "Casual Database Report", blurb: "Master casual dengan rating dan tingkat kehadiran." },
  { type: "payments", title: "Casual Payment Report", blurb: "Perhitungan pembayaran dan status penyelesaian." },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requirePermission("report.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const defaults = monthRange(hotel.timezone);
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;

  const { data } = await supabase.rpc("dashboard_summary", {
    p_hotel: hotel.id,
    p_from: from,
    p_to: to,
    p_department: null,
  });

  const summary = data as DashboardSummary | null;
  const canExport = can(ctx, "report.export");
  const qs = new URLSearchParams({ from, to }).toString();

  return (
    <>
      <PageHeader
        title="Laporan"
        description={`Semua laporan mengikuti filter periode dan cakupan akses Anda. Periode aktif: ${from} s.d. ${to}.`}
      />

      <FilterBar
        filters={[
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
        ]}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((r) => (
          <div key={r.type} className="cr-card flex flex-col p-4">
            <FileBarChart size={18} className="mb-2 text-primary" />
            <p className="text-sm font-semibold text-text">{r.title}</p>
            <p className="mt-1 flex-1 text-xs text-text-muted">{r.blurb}</p>
            {canExport ? (
              <a
                href={`/api/export/${r.type}?${qs}`}
                className={buttonClass("secondary", "sm", "mt-3 w-full")}
              >
                <Download size={13} />
                Export CSV
              </a>
            ) : (
              <p className="mt-3 text-[11px] text-text-faint">
                Anda tidak memiliki izin export.
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Department Usage Report"
            description="Kebutuhan manpower casual per department"
          />
          <TableInner
            head={["Department", "Request", "Casual"]}
            rows={(summary?.by_department ?? []).map((d) => [
              d.department,
              formatNumber(d.requests),
              formatNumber(d.qty),
            ])}
          />
        </Card>

        <Card>
          <CardHeader title="Budget Report" description="Budget, realisasi, dan sisa" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Figure
              label="Budget"
              value={formatMoney(summary?.kpi.budget_amount ?? 0, hotel.currency)}
            />
            <Figure
              label="Realisasi"
              value={formatMoney(summary?.kpi.casual_cost ?? 0, hotel.currency)}
            />
            <Figure
              label="Sisa"
              value={formatMoney(summary?.kpi.budget_remaining ?? 0, hotel.currency)}
              tone={(summary?.kpi.budget_remaining ?? 0) < 0 ? "danger" : "success"}
            />
          </div>
          <div className="border-t border-border">
            <TableInner
              head={["Bulan", "Budget", "Realisasi"]}
              rows={(summary?.cost_trend ?? []).map((c) => [
                c.bucket,
                formatMoney(c.budget, hotel.currency),
                formatMoney(c.actual, hotel.currency),
              ])}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Approval Report" description="Distribusi status pengajuan" />
          <TableInner
            head={["Status", "Jumlah"]}
            rows={(summary?.by_status ?? []).map((s) => [s.status, formatNumber(s.total)])}
          />
        </Card>

        <Card>
          <CardHeader
            title="Employee Performance Report"
            description="Casual dengan penugasan terbanyak pada periode ini"
          />
          <TableInner
            head={["Casual", "Assignment", "Rating", "Kehadiran"]}
            rows={(summary?.top_casuals ?? []).map((c) => [
              `${c.name} (${c.casual_no})`,
              formatNumber(c.assignments),
              Number(c.rating).toFixed(2),
              `${Number(c.attendance_rate).toFixed(0)}%`,
            ])}
          />
        </Card>
      </div>
    </>
  );
}

function TableInner({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-xs text-text-faint">
        Tidak ada data pada periode ini.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <Th key={h} align={i === 0 ? "left" : "right"}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <Td key={j} align={j === 0 ? "left" : "right"}>
                  {cell}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold ${
          tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
