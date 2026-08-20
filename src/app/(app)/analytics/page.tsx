import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, KpiCard, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  AttendanceChart,
  CostTrendChart,
  DepartmentUsageChart,
  RequestTrendChart,
  StatusDonutChart,
} from "@/components/charts/charts";
import {
  ATTENDANCE_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  formatMoney,
  formatNumber,
  monthRange,
} from "@/lib/format";
import type { AnalyticsSummary, DashboardSummary } from "@/types/domain";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requirePermission("analytics.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const defaults = monthRange(hotel.timezone);
  // Analytics defaults to a wider window than the dashboard: trends need history.
  const from = params.from || shiftMonths(defaults.from, -5);
  const to = params.to || defaults.to;

  const [{ data: dashboardRaw }, { data: analyticsRaw }] = await Promise.all([
    supabase.rpc("dashboard_summary", {
      p_hotel: hotel.id,
      p_from: from,
      p_to: to,
      p_department: null,
    }),
    supabase.rpc("analytics_summary", { p_hotel: hotel.id, p_from: from, p_to: to }),
  ]);

  const dashboard = dashboardRaw as DashboardSummary | null;
  const analytics = analyticsRaw as AnalyticsSummary | null;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Analisis utilisasi manpower, kecepatan approval, dan pengeluaran casual. Periode ${from} s.d. ${to}.`}
      />

      <FilterBar
        filters={[
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
        ]}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Request"
          value={formatNumber(analytics?.total_requests ?? 0)}
          hint={`Rata-rata ${analytics?.avg_qty_per_request ?? 0} casual per request`}
          tone="primary"
        />
        <KpiCard
          label="Total Manpower"
          value={formatNumber(analytics?.total_qty ?? 0)}
          hint="Kebutuhan casual kumulatif"
          tone="info"
        />
        <KpiCard
          label="Durasi Approval"
          value={`${Number(analytics?.avg_approval_hours ?? 0).toFixed(1)} jam`}
          hint="Rata-rata dari pengajuan hingga keputusan terakhir"
          tone={Number(analytics?.avg_approval_hours ?? 0) > 48 ? "warning" : "success"}
        />
        <KpiCard
          label="Tingkat Kehadiran"
          value={`${Number(analytics?.attendance_rate ?? 0).toFixed(1)}%`}
          hint={`No show ${Number(analytics?.no_show_rate ?? 0).toFixed(1)}%`}
          tone={Number(analytics?.attendance_rate ?? 0) >= 90 ? "success" : "warning"}
        />
        <KpiCard
          label="Total Spending"
          value={formatMoney(analytics?.total_spend ?? 0, hotel.currency)}
          hint={`Belum dibayar ${formatMoney(analytics?.unpaid_amount ?? 0, hotel.currency)}`}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RequestTrendChart data={dashboard?.request_trend ?? []} />
        <DepartmentUsageChart data={dashboard?.by_department ?? []} />
        <CostTrendChart
          data={(dashboard?.cost_trend ?? []).map((c) => ({
            bucket: c.bucket,
            actual: Number(c.actual),
            budget: Number(c.budget),
          }))}
        />
        <AttendanceChart
          data={(dashboard?.attendance_mix ?? []).map((a) => ({
            name: ATTENDANCE_STATUS_LABEL[a.status] ?? a.status,
            value: a.total,
          }))}
        />
        <StatusDonutChart
          title="Distribusi Status Request"
          data={(dashboard?.by_status ?? []).map((s) => ({
            name: REQUEST_STATUS_LABEL[s.status] ?? s.status,
            value: s.total,
          }))}
        />

        <Card>
          <CardHeader
            title="Utilisasi Casual"
            description="Seberapa banyak kebutuhan yang benar-benar terisi"
          />
          <div className="space-y-4 p-5">
            <Meter
              label="Pemenuhan manpower"
              value={
                (dashboard?.kpi.casual_needed ?? 0) > 0
                  ? ((dashboard?.kpi.casual_assigned ?? 0) /
                      (dashboard?.kpi.casual_needed ?? 1)) *
                    100
                  : 0
              }
            />
            <Meter label="Tingkat kehadiran" value={Number(analytics?.attendance_rate ?? 0)} />
            <Meter
              label="Penyerapan budget"
              value={
                (dashboard?.kpi.budget_amount ?? 0) > 0
                  ? ((dashboard?.kpi.casual_cost ?? 0) / (dashboard?.kpi.budget_amount ?? 1)) * 100
                  : 0
              }
              invert
            />
            <p className="pt-1 text-xs text-text-muted">
              Casual aktif terdaftar: {formatNumber(analytics?.active_casuals ?? 0)} orang.
            </p>
          </div>
        </Card>
      </section>
    </>
  );
}

function Meter({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const good = invert ? pct <= 80 : pct >= 85;
  const warn = invert ? pct <= 95 : pct >= 60;
  const color = good ? "bg-success" : warn ? "bg-warning" : "bg-danger";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-semibold text-text">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Shifts a YYYY-MM-DD string by a number of months, clamped to day 1. */
function shiftMonths(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
