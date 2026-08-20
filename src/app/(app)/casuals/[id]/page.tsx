import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  PageHeader,
  Td,
  Th,
} from "@/components/ui/primitives";
import {
  ASSIGNMENT_STATUS_LABEL,
  TALENT_CLASS_LABEL,
  TALENT_CLASS_TONE,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  ratingLabel,
} from "@/lib/format";
import type { AssignmentRow, CasualRow, DocumentRow } from "@/types/domain";

export const metadata: Metadata = { title: "Profil Casual" };
export const dynamic = "force-dynamic";

export default async function CasualDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requirePermission("casual.read");
  const supabase = await createClient();

  const { data: casual } = await supabase
    .from("v_casual_directory")
    .select("*")
    .eq("id", id)
    .maybeSingle<CasualRow>();

  if (!casual) notFound();

  const [{ data: assignments }, { data: documents }] = await Promise.all([
    supabase
      .from("v_assignment_detail")
      .select("*")
      .eq("casual_id", id)
      .order("work_date", { ascending: false })
      .limit(25)
      .returns<AssignmentRow[]>(),
    can(ctx, "document.read")
      ? supabase
          .from("documents")
          .select("*")
          .eq("casual_id", id)
          .eq("is_deleted", false)
          .order("uploaded_at", { ascending: false })
          .returns<DocumentRow[]>()
      : Promise.resolve({ data: [] as DocumentRow[] }),
  ]);

  const rating = ratingLabel(Number(casual.avg_rating));
  const currency = ctx.activeHotel?.currency ?? "IDR";

  return (
    <>
      <PageHeader
        title={casual.full_name}
        description={`${casual.casual_no} · bergabung ${formatDate(casual.join_date)}`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Avatar name={casual.full_name} size={52} />
        {casual.is_blacklisted ? (
          <Badge tone="danger">Blacklist aktif</Badge>
        ) : (
          <Badge tone={TALENT_CLASS_TONE[casual.talent_class]}>
            {TALENT_CLASS_LABEL[casual.talent_class]}
          </Badge>
        )}
        <Badge tone={rating.tone}>
          {Number(casual.avg_rating).toFixed(2)} · {rating.label}
        </Badge>
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Assignment" value={formatNumber(casual.total_assignment)} tone="primary" />
        <KpiCard
          label="Tingkat Kehadiran"
          value={`${Number(casual.attendance_rate).toFixed(0)}%`}
          tone={Number(casual.attendance_rate) >= 90 ? "success" : "warning"}
        />
        <KpiCard label="Rating Rata-rata" value={Number(casual.avg_rating).toFixed(2)} tone={rating.tone} />
        <KpiCard
          label="Assignment Terakhir"
          value={formatDate(casual.last_assignment_date)}
          tone="neutral"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Informasi Pribadi" />
          <dl className="space-y-3 p-5 text-sm">
            <Row label="Nama panggilan" value={casual.nickname ?? "—"} />
            <Row
              label="Jenis kelamin"
              value={
                casual.gender === "male"
                  ? "Laki-laki"
                  : casual.gender === "female"
                    ? "Perempuan"
                    : "—"
              }
            />
            <Row label="Telepon" value={casual.phone ?? "—"} />
            <Row label="Email" value={casual.email ?? "—"} />
            <Row label="Alamat" value={casual.address ?? "—"} />
            <Row label="Department preferensi" value={casual.preferred_department_name ?? "—"} />
            <Row label="Pengalaman hotel" value={`${casual.hotel_experience_years} tahun`} />
            <Row label="Skill" value={casual.skills.join(", ") || "—"} />
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Riwayat Penugasan"
              description="25 penugasan terakhir beserta kehadiran dan pembayaran"
            />
            {(assignments ?? []).length === 0 ? (
              <EmptyState title="Belum ada riwayat penugasan" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Tanggal</Th>
                      <Th>Request</Th>
                      <Th>Department</Th>
                      <Th align="center">Durasi</Th>
                      <Th>Status</Th>
                      <Th align="center">Rating</Th>
                      <Th align="right">Pembayaran</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assignments ?? []).map((a) => (
                      <tr key={a.id}>
                        <Td>{formatDate(a.work_date)}</Td>
                        <Td>
                          <Link
                            href={`/requests/${a.request_id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {a.request_no}
                          </Link>
                        </Td>
                        <Td>{a.department_name}</Td>
                        <Td align="center">
                          {a.working_minutes ? formatDuration(a.working_minutes) : "—"}
                        </Td>
                        <Td>
                          <Badge tone={a.status === "cancelled" ? "neutral" : "primary"}>
                            {ASSIGNMENT_STATUS_LABEL[a.status]}
                          </Badge>
                        </Td>
                        <Td align="center">
                          {a.final_rating ? Number(a.final_rating).toFixed(2) : "—"}
                        </Td>
                        <Td align="right">
                          {a.total_amount !== null
                            ? formatMoney(a.total_amount, currency)
                            : "—"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {can(ctx, "document.read") ? (
            <Card>
              <CardHeader
                title="Dokumen"
                description="Berkas privat. Akses hanya melalui signed URL berjangka pendek."
              />
              {(documents ?? []).length === 0 ? (
                <EmptyState title="Belum ada dokumen" description="KTP, CV, dan sertifikat dapat diunggah dari menu Dokumen Arsip." />
              ) : (
                <ul className="divide-y divide-border">
                  {(documents ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{d.file_name}</p>
                        <p className="text-xs text-text-faint">
                          {d.document_type.toUpperCase()} · {(d.file_size / 1024).toFixed(0)} KB ·{" "}
                          {formatDate(d.uploaded_at)}
                        </p>
                      </div>
                      <a
                        href={`/api/documents/${d.id}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Buka
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="text-right text-sm text-text">{value}</dd>
    </div>
  );
}
