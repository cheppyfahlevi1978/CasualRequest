import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ProfilePreferences } from "@/app/(app)/profile/preferences";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Profil Saya" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireSession();

  return (
    <>
      <PageHeader
        title="Profil Saya"
        description="Data identitas dikelola oleh HR Admin. Anda dapat mengubah preferensi tampilan dan notifikasi."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Identitas" />
          <div className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={ctx.profile.full_name || ctx.email} size={52} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {ctx.profile.full_name || "—"}
                </p>
                <p className="truncate text-xs text-text-muted">{ctx.email}</p>
              </div>
            </div>
            <dl className="space-y-2.5 text-sm">
              <Row label="Employee ID" value={ctx.profile.employee_id ?? "—"} />
              <Row label="Jabatan" value={ctx.profile.position ?? "—"} />
              <Row label="Telepon" value={ctx.profile.phone ?? "—"} />
              <Row label="Department" value={ctx.department?.name ?? "—"} />
              <Row label="Unit hotel aktif" value={ctx.activeHotel?.name ?? "—"} />
              <Row
                label="Login terakhir"
                value={ctx.profile.last_login_at ? formatDateTime(ctx.profile.last_login_at) : "—"}
              />
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Role & Izin" description="Ditetapkan oleh HR Admin / Super Admin" />
          <div className="p-5">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ctx.roles.length === 0 ? (
                <span className="text-xs text-text-faint">Belum ada role</span>
              ) : (
                ctx.roles.map((r) => (
                  <Badge key={r} tone={r === "super_admin" ? "primary" : "info"}>
                    {r}
                  </Badge>
                ))
              )}
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {ctx.permissions.length} izin efektif
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-bg-subtle p-3">
              <ul className="space-y-1 font-mono text-[11px] text-text-muted">
                {ctx.permissions.sort().map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Preferensi" description="Tersimpan pada profil dan berlaku di semua perangkat" />
          <div className="p-5">
            <ProfilePreferences
              locale={ctx.profile.locale}
              theme={ctx.profile.theme}
              notifyEmail={ctx.profile.notify_email}
              notifyInapp={ctx.profile.notify_inapp}
            />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Unit hotel yang dapat Anda akses" />
          <ul className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {ctx.hotels.map((h) => (
              <li
                key={h.id}
                className={`rounded-xl border p-3 ${
                  h.id === ctx.activeHotel?.id
                    ? "border-primary/40 bg-primary-soft"
                    : "border-border bg-card-muted"
                }`}
              >
                <p className="font-mono text-[11px] text-text-muted">{h.code}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-text">{h.name}</p>
                <p className="text-[11px] text-text-faint">
                  {h.timezone} · {h.currency}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-right text-sm text-text">{value}</dd>
    </div>
  );
}
