import type { Metadata } from "next";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  Field,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui/primitives";
import { ActionForm } from "@/components/ui/action-form";
import {
  saveApprovalRule,
  saveAttendanceSettings,
  saveBudget,
  saveDepartment,
  saveHotel,
  saveRate,
} from "@/server/actions/admin";
import { APPROVAL_STEP_LABEL, formatMoney, formatDate } from "@/lib/format";
import type { ApprovalRule, Department, RateMaster, Shift } from "@/types/domain";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

interface BudgetRow {
  id: string;
  department_id: string | null;
  period_year: number;
  period_month: number;
  amount: number;
}

export default async function SettingsPage() {
  const ctx = await requireSession();
  const hotel = ctx.activeHotel!;
  const supabase = await createClient();

  const canSettings = can(ctx, "settings.manage");
  const canHotel = can(ctx, "hotel.manage");
  const canDepartment = can(ctx, "department.manage");
  const canBudget = can(ctx, "budget.manage");

  if (!canSettings && !canHotel && !canDepartment && !canBudget) {
    return (
      <>
        <PageHeader title="Pengaturan" />
        <Alert tone="warning" title="Tidak ada pengaturan yang dapat Anda kelola">
          Role Anda tidak memiliki izin konfigurasi pada unit hotel ini.
        </Alert>
      </>
    );
  }

  const [
    { data: departments },
    { data: shifts },
    { data: rates },
    { data: rules },
    { data: budgets },
    { data: attendanceSetting },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, hotel_id, code, name, is_active, sort_order")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<Department[]>(),
    supabase
      .from("shifts")
      .select("id, hotel_id, code, name, start_time, end_time, break_minutes, is_active")
      .eq("hotel_id", hotel.id)
      .order("start_time")
      .returns<Shift[]>(),
    supabase
      .from("rate_master")
      .select("*")
      .eq("hotel_id", hotel.id)
      .order("effective_from", { ascending: false })
      .returns<RateMaster[]>(),
    supabase
      .from("approval_rules")
      .select("*")
      .eq("hotel_id", hotel.id)
      .order("sort_order")
      .returns<ApprovalRule[]>(),
    canBudget
      ? supabase
          .from("budgets")
          .select("id, department_id, period_year, period_month, amount")
          .eq("hotel_id", hotel.id)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false })
          .limit(24)
          .returns<BudgetRow[]>()
      : Promise.resolve({ data: [] as BudgetRow[] }),
    supabase
      .from("settings")
      .select("value")
      .eq("hotel_id", hotel.id)
      .eq("category", "attendance")
      .eq("key", "rules")
      .maybeSingle<{
        value: {
          standard_minutes?: number;
          late_tolerance_minutes?: number;
          require_geolocation?: boolean;
          qr_expiry_minutes?: number;
        };
      }>(),
  ]);

  const attendance = attendanceSetting?.value ?? {};
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description={`Konfigurasi ${hotel.name}. Secret dan kunci privileged tidak pernah disimpan atau ditampilkan di sini.`}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {canHotel ? (
          <Card>
            <CardHeader title="Informasi Hotel" description="Identitas unit, zona waktu, dan geofence" />
            <div className="p-5">
              <ActionForm action={saveHotel} submitLabel="Simpan hotel">
                <input type="hidden" name="id" value={hotel.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kode Hotel" htmlFor="code" required>
                    <input
                      id="code"
                      name="code"
                      required
                      defaultValue={hotel.code}
                      className="cr-input uppercase"
                    />
                  </Field>
                  <Field label="Nama Hotel" htmlFor="name" required>
                    <input id="name" name="name" required defaultValue={hotel.name} className="cr-input" />
                  </Field>
                  <Field label="Telepon" htmlFor="phone">
                    <input id="phone" name="phone" defaultValue={hotel.phone ?? ""} className="cr-input" />
                  </Field>
                  <Field label="Email" htmlFor="email">
                    <input id="email" name="email" defaultValue={hotel.email ?? ""} className="cr-input" />
                  </Field>
                  <Field label="Zona Waktu" htmlFor="timezone">
                    <select id="timezone" name="timezone" defaultValue={hotel.timezone} className="cr-input">
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    </select>
                  </Field>
                  <Field label="Mata Uang" htmlFor="currency">
                    <input
                      id="currency"
                      name="currency"
                      maxLength={3}
                      defaultValue={hotel.currency}
                      className="cr-input uppercase"
                    />
                  </Field>
                  <Field label="Latitude" htmlFor="latitude" hint="Untuk validasi lokasi absensi">
                    <input
                      id="latitude"
                      name="latitude"
                      type="number"
                      step="0.0000001"
                      defaultValue={hotel.latitude ?? ""}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Longitude" htmlFor="longitude">
                    <input
                      id="longitude"
                      name="longitude"
                      type="number"
                      step="0.0000001"
                      defaultValue={hotel.longitude ?? ""}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Radius Geofence (meter)" htmlFor="geofence_radius_m">
                    <input
                      id="geofence_radius_m"
                      name="geofence_radius_m"
                      type="number"
                      min={10}
                      max={5000}
                      defaultValue={hotel.geofence_radius_m}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Status" htmlFor="status">
                    <select id="status" name="status" defaultValue={hotel.status} className="cr-input">
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </Field>
                  <Field label="Alamat" htmlFor="address" className="sm:col-span-2">
                    <textarea
                      id="address"
                      name="address"
                      rows={2}
                      defaultValue={hotel.address ?? ""}
                      className="cr-input resize-y"
                    />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </Card>
        ) : null}

        {canSettings ? (
          <Card>
            <CardHeader
              title="Aturan Absensi"
              description="Jam kerja standar, toleransi keterlambatan, dan validasi lokasi"
            />
            <div className="p-5">
              <ActionForm action={saveAttendanceSettings} submitLabel="Simpan aturan absensi">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Jam kerja standar (menit)"
                    htmlFor="standard_minutes"
                    hint="Kelebihan dari nilai ini dihitung sebagai lembur"
                  >
                    <input
                      id="standard_minutes"
                      name="standard_minutes"
                      type="number"
                      min={60}
                      max={1440}
                      defaultValue={attendance.standard_minutes ?? 480}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Toleransi terlambat (menit)" htmlFor="late_tolerance_minutes">
                    <input
                      id="late_tolerance_minutes"
                      name="late_tolerance_minutes"
                      type="number"
                      min={0}
                      max={180}
                      defaultValue={attendance.late_tolerance_minutes ?? 15}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Masa berlaku QR (menit)" htmlFor="qr_expiry_minutes">
                    <input
                      id="qr_expiry_minutes"
                      name="qr_expiry_minutes"
                      type="number"
                      min={1}
                      max={120}
                      defaultValue={attendance.qr_expiry_minutes ?? 10}
                      className="cr-input"
                    />
                  </Field>
                  <label className="mt-6 flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      name="require_geolocation"
                      defaultChecked={Boolean(attendance.require_geolocation)}
                      className="h-4 w-4 rounded border-border-strong"
                    />
                    Minta lokasi saat check-in
                  </label>
                </div>
              </ActionForm>
            </div>
          </Card>
        ) : null}

        {canDepartment ? (
          <Card>
            <CardHeader title="Department" description={`${departments?.length ?? 0} department terdaftar`} />
            <div className="border-b border-border p-5">
              <ActionForm action={saveDepartment} submitLabel="Tambah department">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Kode" htmlFor="dept-code" required>
                    <input id="dept-code" name="code" required maxLength={10} className="cr-input uppercase" />
                  </Field>
                  <Field label="Nama" htmlFor="dept-name" required className="sm:col-span-2">
                    <input id="dept-name" name="name" required className="cr-input" />
                  </Field>
                </div>
                <input type="hidden" name="is_active" value="on" />
              </ActionForm>
            </div>
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Kode</Th>
                    <Th>Nama</Th>
                    <Th align="right">Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {(departments ?? []).map((d) => (
                    <tr key={d.id}>
                      <Td className="font-mono text-xs">{d.code}</Td>
                      <Td>{d.name}</Td>
                      <Td align="right">
                        <Badge tone={d.is_active ? "success" : "neutral"}>
                          {d.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        ) : null}

        {canSettings ? (
          <Card>
            <CardHeader title="Rate Casual" description="Tarif harian atau per jam beserta lembur" />
            <div className="border-b border-border p-5">
              <ActionForm action={saveRate} submitLabel="Tambah rate">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Posisi" htmlFor="rate-position" required>
                    <input
                      id="rate-position"
                      name="position"
                      required
                      defaultValue="GENERAL"
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Department" htmlFor="rate-dept" hint="Kosongkan untuk berlaku umum">
                    <select id="rate-dept" name="department_id" className="cr-input">
                      <option value="">Semua department</option>
                      {(departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tipe Rate" htmlFor="rate-type" required>
                    <select id="rate-type" name="rate_type" className="cr-input">
                      <option value="daily">Harian</option>
                      <option value="hourly">Per jam</option>
                    </select>
                  </Field>
                  <Field label="Rate" htmlFor="rate-amount" required>
                    <input
                      id="rate-amount"
                      name="rate"
                      type="number"
                      min={0}
                      step={1000}
                      required
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Rate Lembur / jam" htmlFor="rate-ot">
                    <input
                      id="rate-ot"
                      name="overtime_rate"
                      type="number"
                      min={0}
                      step={1000}
                      defaultValue={0}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Uang Makan" htmlFor="rate-meal">
                    <input
                      id="rate-meal"
                      name="meal_allowance"
                      type="number"
                      min={0}
                      step={1000}
                      defaultValue={0}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Uang Transport" htmlFor="rate-transport">
                    <input
                      id="rate-transport"
                      name="transport_allowance"
                      type="number"
                      min={0}
                      step={1000}
                      defaultValue={0}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Berlaku Sejak" htmlFor="rate-from" required>
                    <input
                      id="rate-from"
                      name="effective_from"
                      type="date"
                      required
                      defaultValue={now.toISOString().slice(0, 10)}
                      className="cr-input"
                    />
                  </Field>
                </div>
              </ActionForm>
            </div>
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Posisi</Th>
                    <Th>Tipe</Th>
                    <Th align="right">Rate</Th>
                    <Th align="right">Lembur</Th>
                    <Th align="right">Berlaku</Th>
                  </tr>
                </thead>
                <tbody>
                  {(rates ?? []).map((r) => (
                    <tr key={r.id}>
                      <Td>{r.position}</Td>
                      <Td>{r.rate_type === "daily" ? "Harian" : "Per jam"}</Td>
                      <Td align="right">{formatMoney(r.rate, hotel.currency)}</Td>
                      <Td align="right">{formatMoney(r.overtime_rate, hotel.currency)}</Td>
                      <Td align="right" className="text-xs">
                        {formatDate(r.effective_from)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        ) : null}

        {canSettings ? (
          <Card>
            <CardHeader
              title="Aturan Approval"
              description="Jalur approval ditentukan otomatis dari estimasi biaya request"
            />
            <div className="border-b border-border p-5">
              <ActionForm action={saveApprovalRule} submitLabel="Tambah aturan">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama Aturan" htmlFor="rule-name" required className="sm:col-span-2">
                    <input id="rule-name" name="name" required className="cr-input" />
                  </Field>
                  <Field label="Batas Bawah" htmlFor="rule-min" required>
                    <input
                      id="rule-min"
                      name="min_amount"
                      type="number"
                      min={0}
                      step={1000}
                      required
                      defaultValue={0}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Batas Atas" htmlFor="rule-max" hint="Kosongkan untuk tanpa batas">
                    <input
                      id="rule-max"
                      name="max_amount"
                      type="number"
                      min={0}
                      step={1000}
                      className="cr-input"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <p className="cr-label">Tahap Approval</p>
                    <div className="flex flex-wrap gap-3 rounded-lg border border-border p-3">
                      {(["hod", "hr", "finance", "gm"] as const).map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="steps[]"
                            value={s}
                            defaultChecked={s === "hod" || s === "hr"}
                            className="h-4 w-4 rounded border-border-strong"
                          />
                          {APPROVAL_STEP_LABEL[s]}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </ActionForm>
            </div>
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Aturan</Th>
                    <Th align="right">Rentang</Th>
                    <Th>Tahap</Th>
                  </tr>
                </thead>
                <tbody>
                  {(rules ?? []).map((r) => (
                    <tr key={r.id}>
                      <Td>{r.name}</Td>
                      <Td align="right" className="text-xs">
                        {formatMoney(r.min_amount, hotel.currency)} —{" "}
                        {r.max_amount ? formatMoney(r.max_amount, hotel.currency) : "∞"}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {r.steps.map((s) => (
                            <Badge key={s} tone="info">
                              {s.toUpperCase()}
                            </Badge>
                          ))}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        ) : null}

        {canBudget ? (
          <Card>
            <CardHeader title="Budget Casual" description="Anggaran per bulan, opsional per department" />
            <div className="border-b border-border p-5">
              <ActionForm action={saveBudget} submitLabel="Simpan budget">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tahun" htmlFor="budget-year" required>
                    <input
                      id="budget-year"
                      name="period_year"
                      type="number"
                      min={2000}
                      max={2200}
                      required
                      defaultValue={now.getFullYear()}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Bulan" htmlFor="budget-month" required>
                    <input
                      id="budget-month"
                      name="period_month"
                      type="number"
                      min={1}
                      max={12}
                      required
                      defaultValue={now.getMonth() + 1}
                      className="cr-input"
                    />
                  </Field>
                  <Field label="Department" htmlFor="budget-dept" hint="Kosongkan untuk budget hotel">
                    <select id="budget-dept" name="department_id" className="cr-input">
                      <option value="">Seluruh hotel</option>
                      {(departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jumlah" htmlFor="budget-amount" required>
                    <input
                      id="budget-amount"
                      name="amount"
                      type="number"
                      min={0}
                      step={100000}
                      required
                      className="cr-input"
                    />
                  </Field>
                </div>
              </ActionForm>
            </div>
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Periode</Th>
                    <Th>Department</Th>
                    <Th align="right">Jumlah</Th>
                  </tr>
                </thead>
                <tbody>
                  {(budgets ?? []).map((b) => (
                    <tr key={b.id}>
                      <Td>
                        {b.period_year}-{String(b.period_month).padStart(2, "0")}
                      </Td>
                      <Td>
                        {(departments ?? []).find((d) => d.id === b.department_id)?.name ??
                          "Seluruh hotel"}
                      </Td>
                      <Td align="right">{formatMoney(b.amount, hotel.currency)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Aplikasi & Database"
            description="Informasi lingkungan. Secret dikelola di Vercel/Supabase, bukan di sini."
          />
          <dl className="space-y-3 p-5 text-sm">
            <ConfigRow label="Environment" value={publicEnv.appEnv} />
            <ConfigRow label="Application URL" value={publicEnv.appUrl} />
            <ConfigRow
              label="Supabase Project URL"
              value={process.env.NEXT_PUBLIC_SUPABASE_URL ?? "belum dikonfigurasi"}
            />
            <ConfigRow label="Storage bucket privat" value="casual-request-private" />
            <ConfigRow label="Storage bucket publik" value="hotel-assets" />
            <ConfigRow label="Shift terdaftar" value={`${shifts?.length ?? 0} shift`} />
          </dl>
          <div className="border-t border-border px-5 py-3">
            <p className="text-[11px] text-text-faint">
              Service role key, SMTP credential, dan OAuth secret tidak pernah dikirim ke browser
              maupun disimpan sebagai setting yang dapat diedit.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="max-w-full truncate font-mono text-xs text-text">{value}</dd>
    </div>
  );
}
