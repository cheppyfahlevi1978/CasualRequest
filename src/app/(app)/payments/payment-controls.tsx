"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Banknote, SlidersHorizontal, RefreshCw } from "lucide-react";
import {
  adjustPayment,
  generatePayments,
  setPaymentStatus,
} from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";
import type { PaymentStatus } from "@/types/domain";

export function GeneratePaymentsButton({ requestIds }: { requestIds: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    setBusy(true);
    let total = 0;
    let failure: string | null = null;
    for (const id of requestIds) {
      const result = await generatePayments(id);
      if (result.ok) total += result.data.count;
      else failure = result.error;
    }
    setBusy(false);
    if (failure && total === 0) toast.error("Gagal", failure);
    else toast.success("Selesai", `${total} baris pembayaran dibuat.`);
    router.refresh();
  };

  return (
    <button
      type="button"
      disabled={busy || requestIds.length === 0}
      onClick={() => void run()}
      className={buttonClass("secondary", "sm")}
    >
      <RefreshCw size={13} />
      {busy ? "Memproses…" : "Generate dari absensi"}
    </button>
  );
}

export function PaymentRowActions({
  paymentId,
  status,
  allowance,
  deduction,
  canVerify,
  canPay,
}: {
  paymentId: string;
  status: PaymentStatus;
  allowance: number;
  deduction: number;
  canVerify: boolean;
  canPay: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [reference, setReference] = React.useState("");
  const [values, setValues] = React.useState({ allowance, deduction, notes: "" });

  const move = async (next: PaymentStatus) => {
    setBusy(true);
    const result = await setPaymentStatus(paymentId, next, reference || undefined);
    setBusy(false);
    if (result.ok) {
      toast.success("Diperbarui", result.message);
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  const saveAdjustment = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.set("payment_id", paymentId);
    fd.set("allowance", String(values.allowance));
    fd.set("deduction", String(values.deduction));
    fd.set("notes", values.notes);
    const result = await adjustPayment(undefined, fd);
    setBusy(false);
    if (result.ok) {
      toast.success("Tersimpan", result.message);
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-1.5">
        {canVerify && status !== "paid" ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClass("ghost", "sm")}
            aria-label="Sesuaikan allowance / potongan"
          >
            <SlidersHorizontal size={13} />
          </button>
        ) : null}

        {canVerify && status === "pending" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("verified")}
            className={buttonClass("secondary", "sm")}
          >
            <BadgeCheck size={13} /> Verifikasi
          </button>
        ) : null}

        {canVerify && status === "verified" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("approved")}
            className={buttonClass("secondary", "sm")}
          >
            Setujui
          </button>
        ) : null}

        {canPay && status === "approved" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move("paid")}
            className={buttonClass("success", "sm")}
          >
            <Banknote size={13} /> Tandai dibayar
          </button>
        ) : null}

        {status === "paid" ? <span className="text-xs text-success">Lunas</span> : null}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Penyesuaian pembayaran"
        description="Total = Basic + Allowance + Overtime − Deduction, dihitung ulang oleh database."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAdjustment()}
              className={buttonClass("primary", "sm")}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Allowance" htmlFor="allowance">
            <input
              id="allowance"
              type="number"
              min={0}
              step={1000}
              value={values.allowance}
              onChange={(e) => setValues((v) => ({ ...v, allowance: Number(e.target.value) || 0 }))}
              className="cr-input"
            />
          </Field>
          <Field label="Deduction" htmlFor="deduction">
            <input
              id="deduction"
              type="number"
              min={0}
              step={1000}
              value={values.deduction}
              onChange={(e) => setValues((v) => ({ ...v, deduction: Number(e.target.value) || 0 }))}
              className="cr-input"
            />
          </Field>
          <Field label="Catatan" htmlFor="payment-notes">
            <textarea
              id="payment-notes"
              rows={2}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              className="cr-input resize-y"
            />
          </Field>
          <Field label="Referensi pembayaran" htmlFor="payment-ref" hint="Nomor voucher / transfer">
            <input
              id="payment-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="cr-input"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
