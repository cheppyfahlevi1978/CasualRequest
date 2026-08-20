"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart palette.
 *
 * Categorical hues are chosen to stay distinguishable in both themes and for
 * the most common colour-vision deficiencies; series are never distinguished
 * by hue alone where a label can carry the meaning.
 */
export const SERIES = ["#2f6fae", "#7fa08a", "#c98a2b", "#8e6fb0", "#3f9a86", "#b5545a"];

const AXIS = {
  stroke: "var(--border-strong)",
  tick: { fill: "var(--text-muted)", fontSize: 11 },
};

function TooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  formatter?: (v: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? (
        <p className="mb-1 font-semibold text-text">{String(label)}</p>
      ) : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-text-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color ?? SERIES[i % SERIES.length] }}
          />
          <span>{p.name}</span>
          <strong className="ml-auto text-text">
            {formatter ? formatter(p.value ?? 0) : String(p.value ?? 0)}
          </strong>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  children,
  height = 280,
  empty,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  height?: number;
  empty?: boolean;
}) {
  return (
    <div className="cr-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      {empty ? (
        <div
          className="grid place-items-center text-xs text-text-faint"
          style={{ height }}
        >
          Belum ada data pada periode ini
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const idNumber = (v: number | string) =>
  new Intl.NumberFormat("id-ID").format(Number(v) || 0);
const idMoney = (v: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

// --- 1. Request trend -------------------------------------------------------

export function RequestTrendChart({
  data,
}: {
  data: { bucket: string; requests: number; qty: number }[];
}) {
  return (
    <ChartFrame
      title="Tren Casual Request"
      description="Jumlah request dan kebutuhan manpower per tanggal kerja"
      empty={data.length === 0}
    >
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="bucket" {...AXIS} tickMargin={8} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip content={<TooltipBox formatter={idNumber} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
        <Line
          type="monotone"
          dataKey="requests"
          name="Request"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={{ r: 2.5 }}
        />
        <Line
          type="monotone"
          dataKey="qty"
          name="Kebutuhan casual"
          stroke={SERIES[1]}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ r: 2.5 }}
        />
      </LineChart>
    </ChartFrame>
  );
}

// --- 2. Usage by department -------------------------------------------------

export function DepartmentUsageChart({
  data,
}: {
  data: { department: string; requests: number; qty: number }[];
}) {
  return (
    <ChartFrame
      title="Penggunaan Casual per Department"
      description="Total manpower yang diminta"
      empty={data.length === 0}
      height={Math.max(220, data.length * 38)}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="department" width={110} {...AXIS} />
        <Tooltip content={<TooltipBox formatter={idNumber} />} cursor={{ fill: "var(--bg-subtle)" }} />
        <Bar dataKey="qty" name="Casual" radius={[0, 6, 6, 0]} fill={SERIES[0]} barSize={16} />
      </BarChart>
    </ChartFrame>
  );
}

// --- 3. Request status ------------------------------------------------------

export function StatusDonutChart({
  data,
  title = "Status Request",
}: {
  data: { name: string; value: number }[];
  title?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame title={title} description={`${total} record`} empty={total === 0}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip content={<TooltipBox formatter={idNumber} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
      </PieChart>
    </ChartFrame>
  );
}

// --- 4. Cost trend ----------------------------------------------------------

export function CostTrendChart({
  data,
}: {
  data: { bucket: string; actual: number; budget: number; forecast?: number }[];
}) {
  return (
    <ChartFrame
      title="Tren Biaya Casual"
      description="Budget vs realisasi vs proyeksi"
      empty={data.length === 0}
    >
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 6 }}>
        <defs>
          <linearGradient id="cr-actual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.32} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="bucket" {...AXIS} tickMargin={8} />
        <YAxis
          {...AXIS}
          width={64}
          tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}jt`}
        />
        <Tooltip content={<TooltipBox formatter={idMoney} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
        <Area
          type="monotone"
          dataKey="actual"
          name="Realisasi"
          stroke={SERIES[0]}
          strokeWidth={2}
          fill="url(#cr-actual)"
        />
        <Line type="monotone" dataKey="budget" name="Budget" stroke={SERIES[2]} strokeWidth={2} dot={false} />
        {data.some((d) => d.forecast !== undefined) ? (
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke={SERIES[3]}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        ) : null}
      </AreaChart>
    </ChartFrame>
  );
}

// --- 5. Attendance mix ------------------------------------------------------

export function AttendanceChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame
      title="Performa Kehadiran"
      description="Distribusi status absensi casual"
      empty={total === 0}
    >
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" {...AXIS} tickMargin={8} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip content={<TooltipBox formatter={idNumber} />} cursor={{ fill: "var(--bg-subtle)" }} />
        <Bar dataKey="value" name="Jumlah" radius={[6, 6, 0, 0]} barSize={38}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
