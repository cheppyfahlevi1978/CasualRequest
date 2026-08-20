"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { provisionUser, setUserStatus } from "@/server/actions/admin";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/errors";
import type { Department, Hotel, UserStatus } from "@/types/domain";

const ROLES = [
  { value: "hr_admin", label: "HR Admin" },
  { value: "general_manager", label: "General Manager" },
  { value: "finance", label: "Finance" },
  { value: "hod", label: "Department Head" },
  { value: "supervisor", label: "Supervisor" },
  { value: "viewer", label: "Viewer / Management" },
  { value: "casual_worker", label: "Casual Worker" },
  { value: "super_admin", label: "Super Admin" },
];

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export function UserFormModal({
  hotels,
  departments,
  isSuperAdmin,
  hasServiceKey,
  existing,
  trigger,
}: {
  hotels: Hotel[];
  departments: Department[];
  isSuperAdmin: boolean;
  hasServiceKey: boolean;
  existing?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    employee_id: string | null;
    position: string | null;
    primary_hotel_id: string | null;
    department_id: string | null;
    status: UserStatus;
    role_code: string;
    hotel_ids: string[];
  } | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionResult<{ id: string }> | undefined>();
  const [pending, startTransition] = React.useTransition();

  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await provisionUser(undefined, formData);
      setState(result);
      if (result.ok) {
        toast.success("Tersimpan", result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Gagal", result.error);
      }
    });
  };

  const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f]?.[0] : undefined);
  const roles = isSuperAdmin ? ROLES : ROLES.filter((r) => r.value !== "super_admin");

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
      >
        {trigger}
      </span>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={existing ? `Edit ${existing.full_name}` : "Tambah pengguna"}
        description={
          existing
            ? "Perubahan role dan akses hotel tercatat pada audit log."
            : "Akun dibuat tanpa kata sandi; pengguna menerima tautan untuk mengatur kata sandinya sendiri."
        }
        size="lg"
      >
        {!existing && !hasServiceKey ? (
          <div className="mb-4 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-xs text-warning">
            <strong>SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.</strong> Pembuatan akun baru
            memerlukan kunci privileged di environment server.
          </div>
        ) : null}

        <form action={action} className="space-y-4">
          {existing ? <input type="hidden" name="id" value={existing.id} /> : null}

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
            <Field label="Email" htmlFor="email" required error={err("email")}>
              <input
                id="email"
                name="email"
                type="email"
                required
                readOnly={Boolean(existing)}
                defaultValue={existing?.email ?? ""}
                className="cr-input"
              />
            </Field>
            <Field label="Telepon" htmlFor="phone">
              <input
                id="phone"
                name="phone"
                defaultValue={existing?.phone ?? ""}
                className="cr-input"
              />
            </Field>
            <Field label="Employee ID" htmlFor="employee_id">
              <input
                id="employee_id"
                name="employee_id"
                defaultValue={existing?.employee_id ?? ""}
                className="cr-input"
              />
            </Field>
            <Field label="Jabatan" htmlFor="position">
              <input
                id="position"
                name="position"
                defaultValue={existing?.position ?? ""}
                className="cr-input"
              />
            </Field>
            <Field label="Role" htmlFor="role_code" required error={err("role_code")}>
              <select
                id="role_code"
                name="role_code"
                required
                defaultValue={existing?.role_code ?? "supervisor"}
                className="cr-input"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hotel Utama" htmlFor="primary_hotel_id" required error={err("primary_hotel_id")}>
              <select
                id="primary_hotel_id"
                name="primary_hotel_id"
                required
                defaultValue={existing?.primary_hotel_id ?? hotels[0]?.id ?? ""}
                className="cr-input"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} — {h.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department" htmlFor="department_id" hint="Wajib untuk HOD dan Supervisor">
              <select
                id="department_id"
                name="department_id"
                defaultValue={existing?.department_id ?? ""}
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
            <Field label="Status" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={existing?.status ?? "active"}
                className="cr-input"
              >
                <option value="active">Aktif</option>
                <option value="pending">Menunggu aktivasi</option>
                <option value="inactive">Nonaktif</option>
                <option value="suspended">Ditangguhkan</option>
              </select>
            </Field>
          </div>

          <div>
            <p className="cr-label">Akses unit hotel</p>
            <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
              {hotels.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    name="hotel_ids[]"
                    value={h.id}
                    defaultChecked={
                      existing ? existing.hotel_ids.includes(h.id) : h.id === hotels[0]?.id
                    }
                    className="h-4 w-4 rounded border-border-strong"
                  />
                  {h.code} — {h.name}
                </label>
              ))}
            </div>
            {err("hotel_ids") ? (
              <p className="mt-1 text-xs text-danger">{err("hotel_ids")}</p>
            ) : null}
          </div>

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
            <Submit label={existing ? "Simpan perubahan" : "Buat pengguna"} pending={pending} />
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AddUserButton(props: React.ComponentProps<typeof UserFormModal>) {
  return (
    <UserFormModal
      {...props}
      trigger={
        <span className={buttonClass("primary", "sm")}>
          <UserPlus size={14} />
          Tambah Pengguna
        </span>
      }
    />
  );
}

export function UserStatusToggle({
  userId,
  status,
}: {
  userId: string;
  status: UserStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const next = status === "active" ? "inactive" : "active";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        void (async () => {
          setBusy(true);
          const result = await setUserStatus(userId, next as "active" | "inactive");
          setBusy(false);
          if (result.ok) {
            toast.success("Diperbarui", result.message);
            router.refresh();
          } else {
            toast.error("Gagal", result.error);
          }
        })()
      }
      className={buttonClass(status === "active" ? "secondary" : "success", "sm")}
    >
      {status === "active" ? "Nonaktifkan" : "Aktifkan"}
    </button>
  );
}
