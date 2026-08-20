"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Send, XCircle, Lock } from "lucide-react";
import {
  cancelRequest,
  closeRequest,
  duplicateRequest,
  submitRequest,
} from "@/server/actions/requests";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";

export function RequestActions({
  requestId,
  canSubmit,
  canCancel,
  canClose,
  canDuplicate,
}: {
  requestId: string;
  canSubmit: boolean;
  canCancel: boolean;
  canClose: boolean;
  canDuplicate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const run = async (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result.ok) {
        toast.success("Berhasil", result.message);
        router.refresh();
      } else {
        toast.error("Gagal", result.error);
      }
      return result.ok;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => submitRequest(requestId))}
            className={buttonClass("primary", "sm")}
          >
            <Send size={14} />
            Ajukan Approval
          </button>
        ) : null}

        {canDuplicate ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                const result = await duplicateRequest(requestId);
                setBusy(false);
                if (result.ok) {
                  toast.success("Draft dibuat", result.message);
                  router.push(`/requests/${result.data.id}`);
                } else {
                  toast.error("Gagal", result.error);
                }
              })()
            }
            className={buttonClass("secondary", "sm")}
          >
            <Copy size={14} />
            Duplikat
          </button>
        ) : null}

        <a href={`/requests/${requestId}/print`} className={buttonClass("secondary", "sm")}>
          Cetak
        </a>

        {canClose ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => closeRequest(requestId))}
            className={buttonClass("secondary", "sm")}
          >
            <Lock size={14} />
            Tutup Request
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setCancelOpen(true)}
            className={buttonClass("danger", "sm")}
          >
            <XCircle size={14} />
            Batalkan
          </button>
        ) : null}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan request"
        description="Alasan pembatalan tercatat pada audit trail dan tidak dapat dihapus."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                void (async () => {
                  const fd = new FormData();
                  fd.set("request_id", requestId);
                  fd.set("reason", reason);
                  const okResult = await run(() => cancelRequest(undefined, fd));
                  if (okResult) {
                    setCancelOpen(false);
                    setReason("");
                  }
                })()
              }
              className={buttonClass("danger", "sm")}
            >
              Batalkan request
            </button>
          </>
        }
      >
        <Field label="Alasan pembatalan" htmlFor="cancel-reason" required>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="cr-input resize-y"
            placeholder="Event dibatalkan oleh klien, kebutuhan sudah tercukupi…"
          />
        </Field>
      </Modal>
    </>
  );
}
