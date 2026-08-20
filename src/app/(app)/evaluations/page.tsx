import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/primitives";
import { FilterBar } from "@/components/ui/filter-bar";
import { EvaluationForm } from "@/app/(app)/evaluations/evaluation-form";
import { formatDate, formatDuration, monthRange, ratingLabel } from "@/lib/format";
import type { AssignmentRow, Department, EvaluationRow } from "@/types/domain";

export const metadata: Metadata = { title: "Evaluasi Casual" };
export const dynamic = "force-dynamic";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; department?: string; state?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();
  const canEvaluate = can(ctx, "evaluation.manage");

  const defaults = monthRange(hotel.timezone);
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;

  let query = supabase
    .from("v_assignment_detail")
    .select("*")
    .eq("hotel_id", hotel.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .in("status", ["completed", "present", "absent"]);

  if (params.department) query = query.eq("department_id", params.department);
  if (params.state === "pending") query = query.is("evaluation_id", null);
  if (params.state === "done") query = query.not("evaluation_id", "is", null);

  const [{ data: rows }, { data: departments }] = await Promise.all([
    query.order("work_date", { ascending: false }).limit(200).returns<AssignmentRow[]>(),
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<Department[]>(),
  ]);

  const list = rows ?? [];
  const evaluationIds = list.map((r) => r.evaluation_id).filter(Boolean) as string[];

  const { data: evaluations } = evaluationIds.length
    ? await supabase
        .from("evaluations")
        .select("*")
        .in("id", evaluationIds)
        .returns<EvaluationRow[]>()
    : { data: [] as EvaluationRow[] };

  const byId = new Map((evaluations ?? []).map((e) => [e.id, e]));

  return (
    <>
      <PageHeader
        title="Evaluasi Casual"
        description="Nilai 8 kriteria setelah penugasan selesai. Rating rata-rata otomatis memperbarui klasifikasi talent pool."
      />

      <FilterBar
        filters={[
          { name: "from", label: "Dari tanggal", type: "date" },
          { name: "to", label: "Sampai", type: "date" },
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
            name: "state",
            label: "Status evaluasi",
            type: "select",
            options: [
              { value: "", label: "Semua" },
              { value: "pending", label: "Belum dinilai" },
              { value: "done", label: "Sudah dinilai" },
            ],
          },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="Belum ada penugasan yang bisa dinilai"
            description="Evaluasi tersedia setelah casual menyelesaikan penugasan pada periode ini."
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Casual</Th>
                <Th>Request</Th>
                <Th>Department</Th>
                <Th>Tanggal</Th>
                <Th align="center">Durasi</Th>
                <Th align="center">Rating</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const evaluation = r.evaluation_id ? byId.get(r.evaluation_id) : undefined;
                const rating = evaluation ? ratingLabel(Number(evaluation.final_rating)) : null;
                return (
                  <tr key={r.id} className="transition hover:bg-bg-subtle">
                    <Td>
                      <Link
                        href={`/casuals/${r.casual_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.casual_name}
                      </Link>
                      <p className="text-xs text-text-faint">{r.casual_no}</p>
                    </Td>
                    <Td>
                      <Link
                        href={`/requests/${r.request_id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {r.request_no}
                      </Link>
                    </Td>
                    <Td>{r.department_name}</Td>
                    <Td>{formatDate(r.work_date)}</Td>
                    <Td align="center">
                      {r.working_minutes ? formatDuration(r.working_minutes) : "—"}
                    </Td>
                    <Td align="center">
                      {evaluation && rating ? (
                        <Badge tone={rating.tone}>
                          {Number(evaluation.final_rating).toFixed(2)} · {rating.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-faint">Belum dinilai</span>
                      )}
                    </Td>
                    <Td align="right">
                      {canEvaluate ? (
                        <EvaluationForm
                          assignmentId={r.id}
                          casualName={r.casual_name}
                          requestNo={r.request_no}
                          existing={
                            evaluation
                              ? (evaluation as unknown as Record<string, number | string | null>)
                              : null
                          }
                        />
                      ) : (
                        <span className="text-xs text-text-faint">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
