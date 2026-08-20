import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, ShieldAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Alert,
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
import { formatDate, todayIn } from "@/lib/format";
import type { DocumentRow } from "@/types/domain";

export const metadata: Metadata = { title: "Dokumen Arsip" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ktp: "KTP",
  cv: "CV",
  certificate: "Sertifikat",
  agreement: "Perjanjian",
  warning_letter: "Surat Peringatan",
  photo: "Foto",
  attendance_evidence: "Bukti Absensi",
  request_attachment: "Lampiran Request",
  other: "Lainnya",
};

interface JoinedDocument extends DocumentRow {
  casual_workers: { casual_no: string; full_name: string } | null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; expiring?: string }>;
}) {
  const ctx = await requirePermission("document.read");
  const params = await searchParams;
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("*, casual_workers(casual_no, full_name)")
    .eq("hotel_id", hotel.id)
    .eq("is_deleted", false);

  if (params.type) query = query.eq("document_type", params.type);
  if (params.q) {
    const term = `%${params.q.replace(/[%_]/g, "")}%`;
    query = query.or(`file_name.ilike.${term},title.ilike.${term}`);
  }
  if (params.expiring === "1") {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    query = query.not("expires_at", "is", null).lte("expires_at", in30.toISOString().slice(0, 10));
  }

  const { data } = await query.order("uploaded_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as JoinedDocument[];
  const today = todayIn(hotel.timezone);

  return (
    <>
      <PageHeader
        title="Dokumen Arsip"
        description="KTP, CV, sertifikat, perjanjian, dan surat peringatan. Semua berkas privat, diakses melalui tautan bertanda tangan berumur pendek."
      />

      <div className="mb-5">
        <Alert tone="info" title="Dokumen privat">
          Tidak ada URL publik permanen untuk berkas rahasia. Saat Anda menekan Buka, aplikasi
          menerbitkan signed URL yang kedaluwarsa dalam 2 menit dan mencatat aksesnya pada activity
          log.
        </Alert>
      </div>

      <FilterBar
        filters={[
          { name: "q", label: "Cari", type: "text", placeholder: "Nama berkas / judul" },
          {
            name: "type",
            label: "Jenis dokumen",
            type: "select",
            options: [
              { value: "", label: "Semua jenis" },
              ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            name: "expiring",
            label: "Masa berlaku",
            type: "select",
            options: [
              { value: "", label: "Semua" },
              { value: "1", label: "Kedaluwarsa ≤ 30 hari" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen size={26} />}
            title="Belum ada dokumen"
            description="Unggah dokumen dari profil casual atau dari detail request. Berkas disimpan di Supabase Storage, metadata-nya di PostgreSQL."
          />
        </Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Berkas</Th>
                <Th>Jenis</Th>
                <Th>Pemilik</Th>
                <Th align="right">Ukuran</Th>
                <Th>Diunggah</Th>
                <Th>Masa Berlaku</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const expired = d.expires_at ? d.expires_at < today : false;
                return (
                  <tr key={d.id} className="transition hover:bg-bg-subtle">
                    <Td>
                      <p className="font-medium">{d.title ?? d.file_name}</p>
                      <p className="text-xs text-text-faint">{d.file_name}</p>
                    </Td>
                    <Td>
                      <Badge tone="info">{TYPE_LABEL[d.document_type] ?? d.document_type}</Badge>
                    </Td>
                    <Td>
                      {d.casual_workers ? (
                        <Link
                          href={`/casuals/${d.casual_id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {d.casual_workers.full_name}
                        </Link>
                      ) : d.request_id ? (
                        <Link
                          href={`/requests/${d.request_id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Request
                        </Link>
                      ) : (
                        <span className="text-xs text-text-faint">—</span>
                      )}
                    </Td>
                    <Td align="right" className="text-xs">
                      {(d.file_size / 1024).toFixed(0)} KB
                    </Td>
                    <Td className="text-xs">{formatDate(d.uploaded_at)}</Td>
                    <Td>
                      {d.expires_at ? (
                        <Badge tone={expired ? "danger" : "warning"}>
                          {expired ? "Kedaluwarsa" : formatDate(d.expires_at)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-faint">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <a
                        href={`/api/documents/${d.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <ShieldAlert size={12} />
                        Buka
                      </a>
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
