import type { Metadata } from "next";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { REQUEST_STATUS_LABEL, formatDate } from "@/lib/format";
import type { CasualRow, DocumentRow, Profile, RequestListRow } from "@/types/domain";

export const metadata: Metadata = { title: "Pencarian" };
export const dynamic = "force-dynamic";

/**
 * Global search (PRD §61). Each source is queried through the caller's client,
 * so results are already limited to what the user is allowed to see.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireSession();
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const hotel = ctx.activeHotel!;

  if (term.length < 2) {
    return (
      <>
        <PageHeader title="Pencarian" description="Masukkan minimal 2 karakter." />
        <Card>
          <EmptyState
            icon={<SearchIcon size={26} />}
            title="Cari apa saja"
            description="Nomor request, nama casual, karyawan, department, nama event, atau nama dokumen."
          />
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const like = `%${term.replace(/[%_]/g, "")}%`;

  const [requests, casuals, people, documents] = await Promise.all([
    supabase
      .from("v_request_list")
      .select("id, request_no, department_name, work_date, status, event_name, position_required")
      .eq("hotel_id", hotel.id)
      .or(`request_no.ilike.${like},event_name.ilike.${like},position_required.ilike.${like}`)
      .limit(10)
      .returns<Pick<RequestListRow, "id" | "request_no" | "department_name" | "work_date" | "status" | "event_name" | "position_required">[]>(),
    can(ctx, "casual.read")
      ? supabase
          .from("v_casual_directory")
          .select("id, casual_no, full_name, preferred_department_name, phone")
          .eq("hotel_id", hotel.id)
          .or(`full_name.ilike.${like},casual_no.ilike.${like},phone.ilike.${like}`)
          .limit(10)
          .returns<Pick<CasualRow, "id" | "casual_no" | "full_name" | "preferred_department_name" | "phone">[]>()
      : Promise.resolve({ data: [] }),
    supabase
      .from("profiles")
      .select("id, full_name, email, position")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .is("deleted_at", null)
      .limit(10)
      .returns<Pick<Profile, "id" | "full_name" | "email" | "position">[]>(),
    can(ctx, "document.read")
      ? supabase
          .from("documents")
          .select("id, file_name, title, document_type, casual_id")
          .eq("hotel_id", hotel.id)
          .eq("is_deleted", false)
          .or(`file_name.ilike.${like},title.ilike.${like}`)
          .limit(10)
          .returns<Pick<DocumentRow, "id" | "file_name" | "title" | "document_type" | "casual_id">[]>()
      : Promise.resolve({ data: [] }),
  ]);

  const totalResults =
    (requests.data?.length ?? 0) +
    (casuals.data?.length ?? 0) +
    (people.data?.length ?? 0) +
    (documents.data?.length ?? 0);

  return (
    <>
      <PageHeader
        title={`Hasil untuk “${term}”`}
        description={`${totalResults} hasil ditemukan dalam cakupan akses Anda.`}
      />

      {totalResults === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchIcon size={26} />}
            title="Tidak ada hasil"
            description="Coba kata kunci lain, atau periksa apakah data tersebut berada di unit hotel yang sedang aktif."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(requests.data ?? []).length > 0 ? (
            <Card>
              <CardHeader title="Request" />
              <ul className="divide-y divide-border">
                {(requests.data ?? []).map((r) => (
                  <li key={r.id}>
                    <Link href={`/requests/${r.id}`} className="block px-5 py-3 hover:bg-bg-subtle">
                      <p className="text-sm font-medium text-primary">{r.request_no}</p>
                      <p className="text-xs text-text-muted">
                        {r.department_name} · {r.position_required} · {formatDate(r.work_date)} ·{" "}
                        {REQUEST_STATUS_LABEL[r.status]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {(casuals.data ?? []).length > 0 ? (
            <Card>
              <CardHeader title="Casual Worker" />
              <ul className="divide-y divide-border">
                {(casuals.data ?? []).map((c) => (
                  <li key={c.id}>
                    <Link href={`/casuals/${c.id}`} className="block px-5 py-3 hover:bg-bg-subtle">
                      <p className="text-sm font-medium text-primary">{c.full_name}</p>
                      <p className="text-xs text-text-muted">
                        {c.casual_no} · {c.preferred_department_name ?? "Tanpa department"} ·{" "}
                        {c.phone ?? "tanpa telepon"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {(people.data ?? []).length > 0 ? (
            <Card>
              <CardHeader title="Karyawan" />
              <ul className="divide-y divide-border">
                {(people.data ?? []).map((p) => (
                  <li key={p.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-text">{p.full_name || p.email}</p>
                    <p className="text-xs text-text-muted">
                      {p.email}
                      {p.position ? ` · ${p.position}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {(documents.data ?? []).length > 0 ? (
            <Card>
              <CardHeader title="Dokumen" />
              <ul className="divide-y divide-border">
                {(documents.data ?? []).map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documents/${d.id}`} className="block px-5 py-3 hover:bg-bg-subtle">
                      <p className="text-sm font-medium text-primary">{d.title ?? d.file_name}</p>
                      <p className="text-xs text-text-muted">{d.document_type}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
