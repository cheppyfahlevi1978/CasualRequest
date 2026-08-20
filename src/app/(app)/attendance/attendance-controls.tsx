"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, MoreHorizontal } from "lucide-react";
import { checkIn, checkOut, markAttendance } from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";
import type { AttendanceStatus } from "@/types/domain";

const MANUAL_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Hadir" },
  { value: "late", label: "Terlambat" },
  { value: "absent", label: "Tidak hadir" },
  { value: "no_show", label: "No show" },
  { value: "sick", label: "Sakit" },
  { value: "permission", label: "Izin" },
];

export function AttendanceControls({
  assignmentId,
  hasCheckIn,
  hasCheckOut,
  defaultBreak,
  requireGeolocation,
}: {
  assignmentId: string;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  defaultBreak: number;
  requireGeolocation: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [outOpen, setOutOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [breakMinutes, setBreakMinutes] = React.useState(defaultBreak);
  const [remark, setRemark] = React.useState("");
  const [status, setStatus] = React.useState<AttendanceStatus>("absent");

  const coords = () =>
    new Promise<{ latitude?: number; longitude?: number }>((resolve) => {
      if (!requireGeolocation || typeof navigator === "undefined" || !navigator.geolocation) {
        resolve({});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        // Permission denied is not fatal: the server records it as "unavailable".
        () => resolve({}),
        { timeout: 8000, enableHighAccuracy: true },
      );
    });

  const doCheckIn = async () => {
    setBusy(true);
    const position = await coords();
    const result = await checkIn({ assignment_id: assignmentId, ...position, method: "manual" });
    setBusy(false);
    if (result.ok) {
      toast.success("Check-in tercatat", result.message);
      router.refresh();
    } else {
      toast.error("Gagal check-in", result.error);
    }
  };

  const doCheckOut = async () => {
    setBusy(true);
    const result = await checkOut({
      assignment_id: assignmentId,
      break_minutes: breakMinutes,
      remark,
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Check-out tercatat", result.message);
      setOutOpen(false);
      setRemark("");
      router.refresh();
    } else {
      toast.error("Gagal check-out", result.error);
    }
  };

  const doMark = async () => {
    setBusy(true);
    const result = await markAttendance({ assignment_id: assignmentId, status, remark });
    setBusy(false);
    if (result.ok) {
      toast.success("Status diperbarui", result.message);
      setStatusOpen(false);
      setRemark("");
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-1.5">
        {!hasCheckIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void doCheckIn()}
            className={buttonClass("success", "sm")}
          >
            <LogIn size={13} /> Check-in
          </button>
        ) : !hasCheckOut ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setOutOpen(true)}
            className={buttonClass("primary", "sm")}
          >
            <LogOut size={13} /> Check-out
          </button>
        ) : (
          <span className="text-xs text-text-faint">Selesai</span>
        )}

        <button
          type="button"
          onClick={() => setStatusOpen(true)}
          className={buttonClass("secondary", "sm")}
          aria-label="Ubah status absensi"
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      <Modal
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title="Check-out casual"
        description="Durasi kerja dihitung di server: check-out − check-in − istirahat."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOutOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doCheckOut()}
              className={buttonClass("primary", "sm")}
            >
              {busy ? "Menyimpan…" : "Check-out"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Istirahat (menit)" htmlFor="break-minutes">
            <input
              id="break-minutes"
              type="number"
              min={0}
              max={600}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
              className="cr-input"
            />
          </Field>
          <Field label="Catatan" htmlFor="checkout-remark">
            <textarea
              id="checkout-remark"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="cr-input resize-y"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Ubah status absensi"
        description="Digunakan untuk mencatat absen, sakit, atau izin tanpa check-in."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setStatusOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doMark()}
              className={buttonClass("primary", "sm")}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Status" htmlFor="attendance-status" required>
            <select
              id="attendance-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              className="cr-input"
            >
              {MANUAL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Keterangan" htmlFor="status-remark">
            <textarea
              id="status-remark"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="cr-input resize-y"
              placeholder="Surat dokter, izin keluarga…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
