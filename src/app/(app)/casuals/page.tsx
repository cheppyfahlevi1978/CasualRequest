import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Avatar,
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
import { CasualFormModal } from "@/app/(app)/casuals/casual-form";
import {
  TALENT_CLASS_LABEL,
  TALENT_CLASS_TONE,
  formatDate,
  formatNumber,
  ratingLabel,
} from "@/lib/format";
import type { CasualRow, Department } from "@/types/domain";

export const metadata: Metadata = { title: "Data Casual" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CasualsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    department?: string;
    status?: string;
    talent?: string;
  }>;
}) {
  const ctx = await requirePermission("casual.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();
  const canManage = can(ctx, "casual.manage");

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("v_casual_directory")
    .select("*", { count: "exact" })
    .eq("hotel_id", hotel.id);

  if (params.q) {
    const term = `%${params.q.replace(/[%_]/g, "")}%`;
    query = query.or(`full_name.ilike.${term},casual_no.ilike.${term},phone.ilike.${term}`);
  }
  if (params.department) query = query.eq("preferred_department_id", params.department);
  if (params.status) query = query.eq("status", params.status);
  if (params.talent) query = query.eq("talent_class", params.talent);

  const [{ data, count }, { data: departments }] = await Promise.all([
    query
      .order("full_name")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      .returns<CasualRow[]>(),
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
        title="Data Casual"
        description="Database terpusat seluruh casual worker beserta rating, kehadiran, dan riwayat penugasan."
        actions={
          <>
            {can(ctx, "report.export") ? (
              <a href={`/api/export/casuals?${qs}`} className={buttonClass("secondary", "sm")}>
                Export CSV
              </a>
            ) : null}
            {canManage ? (
              <CasualFormModal
                departments={departments ?? []}
                trigger={<span className={buttonClass("primary", "sm")}>Tambah Casual</span>}
              />
            ) : null}
          </>
        }
      />

      <FilterBar
        filters={[
          { name: "q", label: "Cari", type: "text", placeholder: "Nama / Casual ID / telepon" },
          {
            name: "department",
            label: "Department",
            type: "select",
            options: [
              { value: "", label: "Semua department" },
              ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
            ],
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "", label: "Semua status" },
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Nonaktif" },
              { value: "blacklisted", label: "Blacklist" },
            ],
          },
          {
            name: "talent",
            label: "Klasifikasi",
            type: "select",
            options: [
              { value: "", label: "Semua klasifikasi" },
              ...Object.entries(TALENT_CLASS_LABEL).map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={26} />}
            title="Belum ada data casual"
            description="Tambahkan casual worker agar dapat dialokasikan ke request yang disetujui."
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Casual</Th>
                <Th>Kontak</Th>
                <Th>Department</Th>
                <Th>Skill</Th>
                <Th align="center">Rating</Th>
                <Th align="center">Assignment</Th>
                <Th align="center">Kehadiran</Th>
                <Th>Status</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const r = ratingLabel(Number(c.avg_rating));
                return (
                  <tr key={c.id} className="transition hover:bg-bg-subtle">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.full_name} size={34} />
                        <div className="min-w-0">
                          <Link
                            href={`/casuals/${c.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {c.full_name}
                          </Link>
                          <p className="text-xs text-text-faint">{c.casual_no}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-xs">{c.phone ?? "—"}</p>
                      <p className="text-xs text-text-faint">{c.email ?? "—"}</p>
                    </Td>
                    <Td>{c.preferred_department_name ?? "—"}</Td>
                    <Td>
                      <span className="text-xs text-text-muted">
                        {c.skills.slice(0, 3).join(", ") || "—"}
                      </span>
                    </Td>
                    <Td align="center">
                      <Badge tone={r.tone}>{Number(c.avg_rating).toFixed(2)}</Badge>
                    </Td>
                    <Td align="center">{formatNumber(c.total_assignment)}</Td>
                    <Td align="center">{Number(c.attendance_rate).toFixed(0)}%</Td>
                    <Td>
                      {c.is_blacklisted ? (
                        <Badge tone="danger">Blacklist</Badge>
                      ) : (
                        <Badge tone={TALENT_CLASS_TONE[c.talent_class]}>
                          {TALENT_CLASS_LABEL[c.talent_class]}
                        </Badge>
                      )}
                      <p className="mt-1 text-[11px] text-text-faint">
                        Terakhir: {formatDate(c.last_assignment_date)}
                      </p>
                    </Td>
                    <Td align="right">
                      {canManage ? (
                        <CasualFormModal
                          departments={departments ?? []}
                          existing={c}
                          trigger={
                            <span className="cursor-pointer text-xs font-medium text-primary hover:underline">
                              Edit
                            </span>
                          }
                        />
                      ) : (
                        <Link
                          href={`/casuals/${c.id}`}
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
            baseHref={`/casuals?${qs.toString()}`}
          />
        </TableWrap>
      )}
    </>
  );
}
