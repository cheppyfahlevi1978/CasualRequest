import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  Users,
  UserCheck,
  UserX,
  Wallet,
  PiggyBank,
  ArrowRight,
} from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  LinkButton,
  PageHeader,
  Td,
  Th,
} from "@/components/ui/primitives";
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
  ratingLabel,
} from "@/lib/format";
import type { DashboardSummary, Department } from "@/types/domain";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const EMPTY: DashboardSummary = {
  kpi: {
    total_request: 0,
    pending_approval: 0,
    approved: 0,
    casual_needed: 0,
    casual_assigned: 0,
    casual_present_today: 0,
    casual_absent_today: 0,
    casual_cost: 0,
    committed_cost: 0,
    budget_amount: 0,
    budget_remaining: 0,
  },
  request_trend: [],
  by_department: [],
  by_status: [],
  cost_trend: [],
  attendance_mix: [],
  top_casuals: [],
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; department?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;

  const defaults = monthRange(hotel.timezone);
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;
  const department = params.department || "";

  const supabase = await createClient();

  const [{ data: summaryRaw, error }, { data: departments }] = await Promise.all([
    supabase.rpc("dashboard_summary", {
      p_hotel: hotel.id,
      p_from: from,
      p_to: to,
      p_department: department || null,
    }),
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .eq("is_active", true)
      .order("sort_order")
      .returns<Department[]>(),
  ]);

  const summary = (summaryRaw as DashboardSummary | null) ?? EMPTY;
  const kpi = summary.kpi;

  const budgetUsage =
    kpi.budget_amount > 0 ? Math.min(100, (kpi.casual_cost / kpi.budget_amount) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Dashboard — ${hotel.name}`}
        description={`Ringkasan aktivitas casual untuk periode ${from} s.d. ${to}.`}
        actions={
          can(ctx, "request.create") ? (
            <LinkButton href="/requests/new" size="sm">
              Buat Request
            </LinkButton>
          ) : null
        }
      />

      <FilterBar
        filters={[
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai tanggal", type: "date" },
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

      {error ? (
        <div className="mb-5">
          <Alert tone="warning" title="Data dashboard belum dapat dimuat">
            Aplikasi tetap berjalan, namun ringkasan tidak dapat diambil dari database saat ini.
            Coba muat ulang beberapa saat lagi.
          </Alert>
        </div>
      ) : null}

      {/* KPI cards — PRD §7 */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Request"
          value={formatNumber(kpi.total_request)}
          hint="Periode berjalan"
          tone="primary"
          icon={<FileText size={15} />}
        />
        <KpiCard
          label="Pending Approval"
          value={formatNumber(kpi.pending_approval)}
          hint="Menunggu keputusan"
          tone="warning"
          icon={<Clock size={15} />}
        />
        <KpiCard
          label="Approved"
          value={formatNumber(kpi.approved)}
          hint="Sudah disetujui"
          tone="success"
          icon={<CheckCircle2 size={15} />}
        />
        <KpiCard
          label="Casual Needed"
          value={formatNumber(kpi.casual_needed)}
          hint="Kebutuhan manpower"
          tone="info"
          icon={<Users size={15} />}
        />
        <KpiCard
          label="Casual Assigned"
          value={formatNumber(kpi.casual_assigned)}
          hint={`Sisa ${formatNumber(Math.max(kpi.casual_needed - kpi.casual_assigned, 0))} belum dialokasikan`}
          tone="primary"
          icon={<UserCheck size={15} />}
        />
        <KpiCard
          label="Hadir Hari Ini"
          value={formatNumber(kpi.casual_present_today)}
          hint="Check-in tercatat"
          tone="success"
          icon={<UserCheck size={15} />}
        />
        <KpiCard
          label="Tidak Hadir"
          value={formatNumber(kpi.casual_absent_today)}
          hint="Absent / no show hari ini"
          tone="danger"
          icon={<UserX size={15} />}
        />
        <KpiCard
          label="Casual Cost"
          value={formatMoney(kpi.casual_cost, hotel.currency)}
          hint={`Komitmen ${formatMoney(kpi.committed_cost, hotel.currency)}`}
          tone="warning"
          icon={<Wallet size={15} />}
        />
        <KpiCard
          label="Budget Remaining"
          value={formatMoney(kpi.budget_remaining, hotel.currency)}
          hint={
            kpi.budget_amount > 0
              ? `${budgetUsage.toFixed(1)}% terpakai dari ${formatMoney(kpi.budget_amount, hotel.currency)}`
              : "Budget belum ditetapkan"
          }
          tone={budgetUsage > 90 ? "danger" : budgetUsage > 70 ? "warning" : "success"}
          icon={<PiggyBank size={15} />}
        />
      </section>

      {/* Charts — PRD §8 */}
      <section className="grid gap-4 xl:grid-cols-2">
        <RequestTrendChart data={summary.request_trend} />
        <DepartmentUsageChart data={summary.by_department} />
        <StatusDonutChart
          data={summary.by_status.map((s) => ({
            name: REQUEST_STATUS_LABEL[s.status] ?? s.status,
            value: s.total,
          }))}
        />
        <CostTrendChart data={withForecast(summary.cost_trend)} />
        <AttendanceChart
          data={summary.attendance_mix.map((a) => ({
            name: ATTENDANCE_STATUS_LABEL[a.status] ?? a.status,
            value: a.total,
          }))}
        />

        <Card>
          <CardHeader
            title="Top Casual Worker"
            description="Peringkat berdasarkan jumlah penugasan dan rating"
            action={
              <Link
                href="/talent-pool"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Talent Pool <ArrowRight size={13} />
              </Link>
            }
          />
          {summary.top_casuals.length === 0 ? (
            <EmptyState
              title="Belum ada penugasan"
              description="Ranking akan muncul setelah ada assignment pada periode ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Casual</Th>
                    <Th align="center">Assignment</Th>
                    <Th align="center">Rating</Th>
                    <Th align="right">Kehadiran</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_casuals.map((c) => {
                    const r = ratingLabel(Number(c.rating));
                    return (
                      <tr key={c.casual_no}>
                        <Td>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-text-faint">{c.casual_no}</p>
                        </Td>
                        <Td align="center">{formatNumber(c.assignments)}</Td>
                        <Td align="center">
                          <Badge tone={r.tone}>
                            {Number(c.rating).toFixed(2)} · {r.label}
                          </Badge>
                        </Td>
                        <Td align="right">{Number(c.attendance_rate).toFixed(0)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

/**
 * Forecast = simple moving average of realised cost (PRD §38). Deliberately
 * plain: management reads it as a trend line, not a commitment.
 */
function withForecast(
  data: { bucket: string; actual: number; budget: number }[],
): { bucket: string; actual: number; budget: number; forecast?: number }[] {
  if (data.length < 2) return data;
  const avg = data.reduce((s, d) => s + Number(d.actual), 0) / data.length;
  return data.map((d, i) => ({
    ...d,
    actual: Number(d.actual),
    budget: Number(d.budget),
    forecast: i === data.length - 1 ? Math.round(avg) : undefined,
  }));
}
