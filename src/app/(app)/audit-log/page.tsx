import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
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
import { FilterBar } from "@/components/ui/filter-bar";
import { formatDateTime } from "@/lib/format";
import type { ActivityLogRow, AuditLogRow } from "@/types/domain";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; module?: string; from?: string; to?: string }>;
}) {
  const ctx = await requirePermission("audit.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const tab = params.tab === "changes" ? "changes" : "activity";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const names = new Map<string, string>();

  if (tab === "activity") {
    let query = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("hotel_id", hotel.id);

    if (params.module) query = query.eq("module", params.module);
    if (params.from) query = query.gte("created_at", `${params.from}T00:00:00Z`);
    if (params.to) query = query.lte("created_at", `${params.to}T23:59:59Z`);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      .returns<ActivityLogRow[]>();

    const rows = data ?? [];
    await fillNames(rows.map((r) => r.user_id), names);

    return (
      <Shell tab={tab}>
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon={<ScrollText size={26} />} title="Belum ada aktivitas tercatat" />
          </Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Pengguna</Th>
                  <Th>Aksi</Th>
                  <Th>Modul</Th>
                  <Th>Keterangan</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</Td>
                    <Td className="text-xs">
                      {r.user_id ? (names.get(r.user_id) ?? "—") : "Sistem"}
                    </Td>
                    <Td>
                      <Badge tone="info">{r.action}</Badge>
                    </Td>
                    <Td className="text-xs">{r.module}</Td>
                    <Td className="text-xs text-text-muted">{r.description ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={count ?? rows.length}
              baseHref={`/audit-log?tab=activity`}
            />
          </TableWrap>
        )}
      </Shell>
    );
  }

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("hotel_id", hotel.id);

  if (params.module) query = query.eq("table_name", params.module);
  if (params.from) query = query.gte("changed_at", `${params.from}T00:00:00Z`);
  if (params.to) query = query.lte("changed_at", `${params.to}T23:59:59Z`);

  const { data, count } = await query
    .order("changed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .returns<AuditLogRow[]>();

  const rows = data ?? [];
  await fillNames(rows.map((r) => r.changed_by), names);

  return (
    <Shell tab={tab}>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ScrollText size={26} />} title="Belum ada perubahan data tercatat" />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Diubah oleh</Th>
                <Th>Tabel</Th>
                <Th>Aksi</Th>
                <Th>Field berubah</Th>
                <Th>Nilai lama → baru</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(r.changed_at)}</Td>
                  <Td className="text-xs">
                    {r.changed_by ? (names.get(r.changed_by) ?? "—") : "Sistem"}
                  </Td>
                  <Td className="font-mono text-xs">{r.table_name}</Td>
                  <Td>
                    <Badge
                      tone={
                        r.action === "DELETE" ? "danger" : r.action === "INSERT" ? "success" : "info"
                      }
                    >
                      {r.action}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-text-muted">
                    {(r.changed_fields ?? []).slice(0, 6).join(", ") || "—"}
                  </Td>
                  <Td className="max-w-sm text-[11px] text-text-muted">
                    {(r.changed_fields ?? []).slice(0, 3).map((f) => (
                      <p key={f} className="truncate">
                        <span className="font-medium text-text">{f}</span>:{" "}
                        {String(r.old_value?.[f] ?? "—")} → {String(r.new_value?.[f] ?? "—")}
                      </p>
                    ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? rows.length}
            baseHref={`/audit-log?tab=changes`}
          />
        </TableWrap>
      )}
    </Shell>
  );
}

async function fillNames(ids: (string | null)[], into: Map<string, string>): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (unique.length === 0) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique)
    .returns<{ id: string; full_name: string; email: string }[]>();
  for (const p of data ?? []) into.set(p.id, p.full_name || p.email);
}

function Shell({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Catatan aktivitas dan perubahan data. Bersifat append-only dan tidak dapat diedit oleh pengguna biasa."
      />

      <div className="mb-5 flex gap-2">
        <a
          href="/audit-log?tab=activity"
          className={buttonClass(tab === "activity" ? "primary" : "secondary", "sm")}
        >
          Aktivitas
        </a>
        <a
          href="/audit-log?tab=changes"
          className={buttonClass(tab === "changes" ? "primary" : "secondary", "sm")}
        >
          Perubahan Data
        </a>
      </div>

      <FilterBar
        filters={[
          {
            name: "module",
            label: tab === "activity" ? "Modul" : "Tabel",
            type: "text",
            placeholder: tab === "activity" ? "requests, approvals…" : "casual_requests…",
          },
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
        ]}
      />

      {children}
    </>
  );
}
