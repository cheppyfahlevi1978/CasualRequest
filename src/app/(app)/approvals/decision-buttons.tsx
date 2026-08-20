"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { decideRequest } from "@/server/actions/requests";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";

type Decision = "approved" | "rejected" | "returned";

const COPY: Record<Decision, { title: string; verb: string; hint: string }> = {
  approved: {
    title: "Setujui request",
    verb: "Setujui",
    hint: "Catatan bersifat opsional dan akan tersimpan pada riwayat approval.",
  },
  rejected: {
    title: "Tolak request",
    verb: "Tolak",
    hint: "Alasan penolakan wajib diisi dan dikirimkan ke requester.",
  },
  returned: {
    title: "Kembalikan untuk revisi",
    verb: "Kembalikan",
    hint: "Request kembali dapat diedit oleh requester lalu diajukan ulang.",
  },
};

export function DecisionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState<Decision | null>(null);
  const [remark, setRemark] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!open) return;
    if (open !== "approved" && remark.trim().length < 3) return;

    setBusy(true);
    const fd = new FormData();
    fd.set("request_id", requestId);
    fd.set("decision", open);
    fd.set("remark", remark);
    const result = await decideRequest(undefined, fd);
    setBusy(false);

    if (result.ok) {
      toast.success("Keputusan tersimpan", result.message);
      setOpen(null);
      setRemark("");
      router.refresh();
    } else {
      toast.error("Gagal memproses", result.error);
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen("approved")}
          className={buttonClass("success", "sm")}
        >
          <Check size={14} /> Approve
        </button>
        <button
          type="button"
          onClick={() => setOpen("returned")}
          className={buttonClass("secondary", "sm")}
        >
          <RotateCcw size={14} /> Revisi
        </button>
        <button
          type="button"
          onClick={() => setOpen("rejected")}
          className={buttonClass("danger", "sm")}
        >
          <X size={14} /> Reject
        </button>
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? COPY[open].title : ""}
        description={open ? COPY[open].hint : undefined}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy || (open !== "approved" && remark.trim().length < 3)}
              onClick={() => void submit()}
              className={buttonClass(
                open === "rejected" ? "danger" : open === "approved" ? "success" : "primary",
                "sm",
              )}
            >
              {busy ? "Memproses…" : open ? COPY[open].verb : ""}
            </button>
          </>
        }
      >
        <Field
          label="Catatan"
          htmlFor="decision-remark"
          required={open !== "approved"}
          hint={open === "approved" ? "Opsional" : undefined}
        >
          <textarea
            id="decision-remark"
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="cr-input resize-y"
            placeholder={
              open === "approved"
                ? "Disetujui sesuai kebutuhan operasional…"
                : "Jelaskan alasannya agar requester dapat menindaklanjuti…"
            }
          />
        </Field>
      </Modal>
    </>
  );
}
