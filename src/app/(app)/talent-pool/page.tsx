import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { BlacklistControls } from "@/app/(app)/talent-pool/blacklist-controls";
import { TALENT_CLASS_LABEL, TALENT_CLASS_TONE, formatDate, formatNumber } from "@/lib/format";
import type { CasualRow, TalentClass } from "@/types/domain";

export const metadata: Metadata = { title: "Talent Pool" };
export const dynamic = "force-dynamic";

const GROUPS: { key: TalentClass; blurb: string }[] = [
  { key: "recommended", blurb: "Rating ≥ 4,00 dan sudah teruji pada beberapa penugasan." },
  { key: "available", blurb: "Siap dipakai kembali dengan performa stabil." },
  { key: "new", blurb: "Belum banyak penugasan, perlu pendampingan." },
  { key: "on_review", blurb: "Rating di bawah 3,00 — membutuhkan evaluasi lanjutan." },
  { key: "do_not_assign", blurb: "Tidak direkomendasikan atau sedang dalam blacklist." },
];

export default async function TalentPoolPage() {
  const ctx = await requirePermission("casual.read");
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();
  const canBlacklist = can(ctx, "casual.blacklist_manage");

  const { data } = await supabase
    .from("v_casual_directory")
    .select("*")
    .eq("hotel_id", hotel.id)
    .order("avg_rating", { ascending: false })
    .limit(500)
    .returns<CasualRow[]>();

  const all = data ?? [];
  const grouped = new Map<TalentClass, CasualRow[]>();
  for (const c of all) {
    const list = grouped.get(c.talent_class) ?? [];
    list.push(c);
    grouped.set(c.talent_class, list);
  }

  return (
    <>
      <PageHeader
        title="Talent Pool"
        description="Klasifikasi casual dihitung otomatis dari rating evaluasi, jumlah penugasan, dan status blacklist."
      />

      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Star size={26} />}
            title="Talent pool masih kosong"
            description="Tambahkan casual worker pada menu Data Casual terlebih dahulu."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const list = grouped.get(g.key) ?? [];
            return (
              <Card key={g.key}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Badge tone={TALENT_CLASS_TONE[g.key]}>{TALENT_CLASS_LABEL[g.key]}</Badge>
                      <span className="text-text-muted">{formatNumber(list.length)} casual</span>
                    </span>
                  }
                  description={g.blurb}
                />
                {list.length === 0 ? (
                  <p className="px-5 py-6 text-center text-xs text-text-faint">
                    Belum ada casual pada klasifikasi ini.
                  </p>
                ) : (
                  <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card-muted p-3"
                      >
                        <Avatar name={c.full_name} size={38} />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/casuals/${c.id}`}
                            className="block truncate text-sm font-medium text-primary hover:underline"
                          >
                            {c.full_name}
                          </Link>
                          <p className="truncate text-[11px] text-text-faint">
                            {c.casual_no} · {c.preferred_department_name ?? "Tanpa department"}
                          </p>
                          <p className="mt-1 text-[11px] text-text-muted">
                            ★ {Number(c.avg_rating).toFixed(2)} ·{" "}
                            {formatNumber(c.total_assignment)} assignment ·{" "}
                            {Number(c.attendance_rate).toFixed(0)}% hadir
                          </p>
                          <p className="text-[11px] text-text-faint">
                            Terakhir: {formatDate(c.last_assignment_date)}
                          </p>
                          {canBlacklist ? (
                            <div className="mt-2">
                              <BlacklistControls
                                casualId={c.id}
                                casualName={c.full_name}
                                isBlacklisted={c.is_blacklisted}
                              />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
