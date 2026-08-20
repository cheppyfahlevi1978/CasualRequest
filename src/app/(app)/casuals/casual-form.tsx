"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveCasual } from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/errors";
import type { CasualRow, Department } from "@/types/domain";

function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
      <Save size={14} />
      {pending ? "Menyimpan…" : "Simpan"}
    </button>
  );
}

export function CasualFormModal({
  departments,
  existing,
  trigger,
}: {
  departments: Department[];
  existing?: CasualRow | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionResult<{ id: string }> | undefined>();
  const [pending, startTransition] = React.useTransition();

  // Submitting from a transition instead of useActionState keeps the "close on
  // success" decision in the event path, where it belongs.
  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveCasual(undefined, formData);
      setState(result);
      if (result.ok) {
        toast.success("Tersimpan", result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Gagal menyimpan", result.error);
      }
    });
  };

  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f]?.[0] : undefined);

  return (
    <>
      <span onClick={() => setOpen(true)} role="button" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
      >
        {trigger}
      </span>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={existing ? `Edit ${existing.full_name}` : "Tambah casual baru"}
        description="Casual ID dibuat otomatis oleh sistem dengan format CSL-00001."
        size="lg"
      >
        <form action={action} className="space-y-5">
          {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Data pribadi
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Lengkap" htmlFor="full_name" required error={err("full_name")}>
                <input
                  id="full_name"
                  name="full_name"
                  required
                  defaultValue={existing?.full_name ?? ""}
                  className="cr-input"
                />
              </Field>
              <Field label="Nama Panggilan" htmlFor="nickname">
                <input
                  id="nickname"
                  name="nickname"
                  defaultValue={existing?.nickname ?? ""}
                  className="cr-input"
                />
              </Field>
              <Field label="Tempat Lahir" htmlFor="place_of_birth">
                <input id="place_of_birth" name="place_of_birth" className="cr-input" />
              </Field>
              <Field label="Tanggal Lahir" htmlFor="date_of_birth">
                <input id="date_of_birth" name="date_of_birth" type="date" className="cr-input" />
              </Field>
              <Field label="Jenis Kelamin" htmlFor="gender">
                <select
                  id="gender"
                  name="gender"
                  defaultValue={existing?.gender ?? ""}
                  className="cr-input"
                >
                  <option value="">Tidak disebutkan</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </Field>
              <Field label="Nomor Telepon" htmlFor="phone" error={err("phone")}>
                <input
                  id="phone"
                  name="phone"
                  defaultValue={existing?.phone ?? ""}
                  className="cr-input"
                  placeholder="+62 812 …"
                />
              </Field>
              <Field label="Email" htmlFor="email" error={err("email")}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={existing?.email ?? ""}
                  className="cr-input"
                />
              </Field>
              <Field label="Alamat" htmlFor="address" className="sm:col-span-2">
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  defaultValue={existing?.address ?? ""}
                  className="cr-input resize-y"
                />
              </Field>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Kepegawaian
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department Preferensi" htmlFor="preferred_department_id">
                <select
                  id="preferred_department_id"
                  name="preferred_department_id"
                  defaultValue={existing?.preferred_department_id ?? ""}
                  className="cr-input"
                >
                  <option value="">Tidak ada</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Skill" htmlFor="skills" hint="Pisahkan dengan koma">
                <input
                  id="skills"
                  name="skills"
                  defaultValue={existing?.skills.join(", ") ?? ""}
                  className="cr-input"
                  placeholder="banquet, service, barista"
                />
              </Field>
              <Field label="Pengalaman Hotel (tahun)" htmlFor="hotel_experience_years">
                <input
                  id="hotel_experience_years"
                  name="hotel_experience_years"
                  type="number"
                  step="0.5"
                  min={0}
                  max={60}
                  defaultValue={existing?.hotel_experience_years ?? 0}
                  className="cr-input"
                />
              </Field>
              <Field label="Perusahaan Sebelumnya" htmlFor="previous_employer">
                <input id="previous_employer" name="previous_employer" className="cr-input" />
              </Field>
              <Field label="Tanggal Bergabung" htmlFor="join_date">
                <input
                  id="join_date"
                  name="join_date"
                  type="date"
                  defaultValue={existing?.join_date ?? ""}
                  className="cr-input"
                />
              </Field>
              <Field label="Status" htmlFor="status">
                <select
                  id="status"
                  name="status"
                  defaultValue={existing?.status === "inactive" ? "inactive" : "active"}
                  className="cr-input"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </Field>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Kontak darurat
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nama" htmlFor="emergency_name">
                <input id="emergency_name" name="emergency_name" className="cr-input" />
              </Field>
              <Field label="Hubungan" htmlFor="emergency_relationship">
                <input
                  id="emergency_relationship"
                  name="emergency_relationship"
                  className="cr-input"
                />
              </Field>
              <Field label="Telepon" htmlFor="emergency_phone">
                <input id="emergency_phone" name="emergency_phone" className="cr-input" />
              </Field>
            </div>
          </section>

          <Field label="Catatan" htmlFor="notes">
            <textarea id="notes" name="notes" rows={2} className="cr-input resize-y" />
          </Field>

          {state && !state.ok ? (
            <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <Submit pending={pending} />
          </div>
        </form>
      </Modal>
    </>
  );
}
