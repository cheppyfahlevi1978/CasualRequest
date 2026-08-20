"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Send } from "lucide-react";
import { saveRequest } from "@/server/actions/requests";
import { Card, CardHeader, Field, buttonClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import type { ActionResult } from "@/lib/errors";
import type { Department, RequestListRow, Shift } from "@/types/domain";

interface RateHint {
  rate: number;
  overtime_rate: number;
  rate_type: "daily" | "hourly";
}

function Submit({
  intent,
  label,
  variant,
  icon,
}: {
  intent: "draft" | "submit";
  label: string;
  variant: "primary" | "secondary";
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={buttonClass(variant, "md")}
    >
      {icon}
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export function RequestForm({
  departments,
  shifts,
  currency,
  defaultDepartmentId,
  rateHint,
  existing,
}: {
  departments: Department[];
  shifts: Shift[];
  currency: string;
  defaultDepartmentId: string | null;
  rateHint: RateHint | null;
  existing?: RequestListRow | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState<ActionResult<{ id: string }> | undefined, FormData>(
    saveRequest,
    undefined,
  );

  const [rate, setRate] = React.useState<number>(
    existing?.rate || rateHint?.rate || 0,
  );
  const [qty, setQty] = React.useState<number>(existing?.qty_required ?? 1);
  const [type, setType] = React.useState<"operational" | "event">(
    existing?.request_type ?? "operational",
  );
  const [shiftId, setShiftId] = React.useState<string>(existing?.shift_id ?? "");
  const [start, setStart] = React.useState(existing?.start_time?.slice(0, 5) ?? "07:00");
  const [end, setEnd] = React.useState(existing?.end_time?.slice(0, 5) ?? "15:00");

  const estimated = Math.max(0, rate * qty);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Berhasil", state.message);
      router.push(`/requests/${state.data.id}`);
    } else {
      toast.error("Gagal menyimpan", state.error);
    }
  }, [state, toast, router]);

  const err = (field: string) =>
    state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;

  const applyShift = (id: string) => {
    setShiftId(id);
    const s = shifts.find((x) => x.id === id);
    if (s) {
      setStart(s.start_time.slice(0, 5));
      setEnd(s.end_time.slice(0, 5));
    }
  };

  return (
    <form action={action} className="space-y-5">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

      <Card>
        <CardHeader
          title="Informasi Request"
          description="Identitas pengajuan dan konteks kebutuhan casual"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Department" htmlFor="department_id" required error={err("department_id")}>
            <select
              id="department_id"
              name="department_id"
              required
              defaultValue={existing?.department_id ?? defaultDepartmentId ?? ""}
              className="cr-input"
            >
              <option value="">Pilih department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Posisi Dibutuhkan" htmlFor="position_required" required error={err("position_required")}>
            <input
              id="position_required"
              name="position_required"
              required
              maxLength={80}
              defaultValue={existing?.position_required ?? "Casual General"}
              className="cr-input"
              placeholder="Waiter, Room Attendant, Steward…"
            />
          </Field>

          <Field label="Tipe Request" htmlFor="request_type" required>
            <select
              id="request_type"
              name="request_type"
              value={type}
              onChange={(e) => setType(e.target.value as "operational" | "event")}
              className="cr-input"
            >
              <option value="operational">Operational</option>
              <option value="event">Event</option>
            </select>
          </Field>

          {type === "event" ? (
            <Field
              label="Nama Event"
              htmlFor="event_name"
              required
              error={err("event_name")}
              className="sm:col-span-2"
            >
              <input
                id="event_name"
                name="event_name"
                maxLength={160}
                defaultValue={existing?.event_name ?? ""}
                className="cr-input"
                placeholder="Wedding Package 500 pax"
              />
            </Field>
          ) : null}

          <Field label="Lokasi" htmlFor="location" error={err("location")}>
            <input
              id="location"
              name="location"
              maxLength={160}
              defaultValue={existing?.location ?? ""}
              className="cr-input"
              placeholder="Ballroom, Lobby, Kitchen…"
            />
          </Field>

          <Field
            label="Alasan Kebutuhan"
            htmlFor="reason"
            required
            error={err("reason")}
            className="sm:col-span-2 lg:col-span-3"
          >
            <textarea
              id="reason"
              name="reason"
              required
              rows={2}
              maxLength={1000}
              defaultValue={existing?.reason ?? ""}
              className="cr-input resize-y"
              placeholder="Occupancy tinggi, event banquet, penggantian karyawan cuti…"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Informasi Pekerjaan" description="Tanggal, jam kerja, dan jumlah manpower" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tanggal Kerja" htmlFor="work_date" required error={err("work_date")}>
            <input
              id="work_date"
              name="work_date"
              type="date"
              required
              defaultValue={existing?.work_date ?? ""}
              className="cr-input"
            />
          </Field>

          <Field label="Shift" htmlFor="shift_id">
            <select
              id="shift_id"
              name="shift_id"
              value={shiftId}
              onChange={(e) => applyShift(e.target.value)}
              className="cr-input"
            >
              <option value="">Tanpa shift / kustom</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Jumlah Casual" htmlFor="qty_required" required error={err("qty_required")}>
            <input
              id="qty_required"
              name="qty_required"
              type="number"
              min={1}
              max={500}
              required
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 0)}
              className="cr-input"
            />
          </Field>

          <Field label="Jam Mulai" htmlFor="start_time" required error={err("start_time")}>
            <input
              id="start_time"
              name="start_time"
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="cr-input"
            />
          </Field>

          <Field label="Jam Selesai" htmlFor="end_time" required error={err("end_time")}>
            <input
              id="end_time"
              name="end_time"
              type="time"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="cr-input"
            />
          </Field>

          <Field label="Estimasi Jam Kerja" htmlFor="estimated_hours" required error={err("estimated_hours")}>
            <input
              id="estimated_hours"
              name="estimated_hours"
              type="number"
              step="0.5"
              min={0.5}
              max={24}
              required
              defaultValue={existing?.estimated_hours ?? 8}
              className="cr-input"
            />
          </Field>

          <Field label="Preferensi Gender" htmlFor="gender_preference" hint="Opsional">
            <select
              id="gender_preference"
              name="gender_preference"
              defaultValue=""
              className="cr-input"
            >
              <option value="">Tidak ada preferensi</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </Field>

          <Field
            label="Syarat Pengalaman"
            htmlFor="experience_required"
            hint="Opsional"
            className="sm:col-span-2"
          >
            <input
              id="experience_required"
              name="experience_required"
              maxLength={200}
              defaultValue={existing?.event_name ? "" : ""}
              className="cr-input"
              placeholder="Minimal 1 tahun pengalaman banquet"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Budget"
          description="Estimasi biaya dihitung ulang di server sebelum disimpan"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label={`Rate per Casual (${currency})`}
            htmlFor="rate"
            required
            error={err("rate")}
            hint={
              rateHint
                ? `Rate master: ${formatMoney(rateHint.rate, currency)} / ${rateHint.rate_type === "daily" ? "hari" : "jam"}`
                : undefined
            }
          >
            <input
              id="rate"
              name="rate"
              type="number"
              min={0}
              step={1000}
              required
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              className="cr-input"
            />
          </Field>

          <Field label="Quantity" htmlFor="qty_display">
            <input id="qty_display" value={qty} readOnly disabled className="cr-input" />
          </Field>

          <div className="sm:col-span-2">
            <p className="cr-label">Estimated Cost</p>
            <div className="rounded-[0.625rem] border border-primary/25 bg-primary-soft px-4 py-2.5">
              <p className="text-lg font-semibold text-primary">
                {formatMoney(estimated, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Rate × Quantity. Nilai ini menentukan jalur approval yang berlaku.
              </p>
            </div>
          </div>

          <Field label="Catatan Tambahan" htmlFor="notes" className="sm:col-span-2 lg:col-span-4">
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={1000}
              className="cr-input resize-y"
              placeholder="Kebutuhan seragam, briefing, PIC lapangan…"
            />
          </Field>
        </div>
      </Card>

      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Submit intent="draft" label="Simpan Draft" variant="secondary" icon={<Save size={16} />} />
        <Submit intent="submit" label="Ajukan Approval" variant="primary" icon={<Send size={16} />} />
      </div>
    </form>
  );
}
