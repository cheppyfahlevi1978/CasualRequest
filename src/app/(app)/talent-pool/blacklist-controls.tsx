"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import { addToBlacklist, releaseBlacklist } from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";

export function BlacklistControls({
  casualId,
  casualName,
  isBlacklisted,
}: {
  casualId: string;
  casualName: string;
  isBlacklisted: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    let result;
    if (isBlacklisted) {
      result = await releaseBlacklist(casualId, reason);
    } else {
      const fd = new FormData();
      fd.set("casual_id", casualId);
      fd.set("reason", reason);
      result = await addToBlacklist(undefined, fd);
    }
    setBusy(false);

    if (result.ok) {
      toast.success("Tersimpan", result.message);
      setOpen(false);
      setReason("");
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass(isBlacklisted ? "secondary" : "danger", "sm")}
      >
        {isBlacklisted ? <ShieldCheck size={13} /> : <Ban size={13} />}
        {isBlacklisted ? "Cabut blacklist" : "Blacklist"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isBlacklisted ? `Cabut blacklist ${casualName}` : `Blacklist ${casualName}`}
        description={
          isBlacklisted
            ? "Casual kembali dapat dipilih pada assignment setelah blacklist dicabut."
            : "Alasan wajib diisi dan hanya dapat dilihat oleh HR Admin dan Super Admin."
        }
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
              disabled={busy || reason.trim().length < 5}
              onClick={() => void submit()}
              className={buttonClass(isBlacklisted ? "primary" : "danger", "sm")}
            >
              {busy ? "Menyimpan…" : isBlacklisted ? "Cabut blacklist" : "Blacklist casual"}
            </button>
          </>
        }
      >
        <Field label="Alasan" htmlFor="blacklist-reason" required>
          <textarea
            id="blacklist-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="cr-input resize-y"
            placeholder={
              isBlacklisted
                ? "Sudah menjalani pembinaan dan menunjukkan perbaikan…"
                : "Tidak hadir tanpa kabar pada 3 penugasan berturut-turut…"
            }
          />
        </Field>
      </Modal>
    </>
  );
}
