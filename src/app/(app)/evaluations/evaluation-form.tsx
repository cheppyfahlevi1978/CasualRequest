"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { saveEvaluation } from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Field } from "@/components/ui/primitives";
import { ratingLabel } from "@/lib/format";
import type { ActionResult } from "@/lib/errors";

const CRITERIA = [
  { name: "score_attendance", label: "Kehadiran" },
  { name: "score_discipline", label: "Kedisiplinan" },
  { name: "score_attitude", label: "Sikap" },
  { name: "score_grooming", label: "Grooming" },
  { name: "score_skill", label: "Keterampilan" },
  { name: "score_teamwork", label: "Kerja sama" },
  { name: "score_communication", label: "Komunikasi" },
  { name: "score_overall", label: "Performa keseluruhan" },
] as const;

function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
      {pending ? "Menyimpan…" : "Simpan evaluasi"}
    </button>
  );
}

export function EvaluationForm({
  assignmentId,
  casualName,
  requestNo,
  existing,
}: {
  assignmentId: string;
  casualName: string;
  requestNo: string;
  existing?: Record<string, number | string | null> | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [scores, setScores] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(
      CRITERIA.map((c) => [c.name, Number(existing?.[c.name] ?? 4)]),
    ),
  );
  const [state, setState] = React.useState<ActionResult<null> | undefined>();
  const [pending, startTransition] = React.useTransition();

  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveEvaluation(undefined, formData);
      setState(result);
      if (result.ok) {
        toast.success("Evaluasi tersimpan", result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Gagal", result.error);
      }
    });
  };

  const average =
    CRITERIA.reduce((sum, c) => sum + (scores[c.name] ?? 0), 0) / CRITERIA.length;
  const label = ratingLabel(average);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass(existing ? "secondary" : "primary", "sm")}
      >
        <ClipboardList size={13} />
        {existing ? "Ubah nilai" : "Nilai"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Evaluasi ${casualName}`}
        description={`Penugasan ${requestNo}. Skala 1–5 untuk setiap kriteria.`}
      >
        <form action={action} className="space-y-5">
          <input type="hidden" name="assignment_id" value={assignmentId} />

          <div className="grid gap-3 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <div key={c.name}>
                <label className="cr-label" htmlFor={c.name}>
                  {c.label}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id={c.name}
                    name={c.name}
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={scores[c.name]}
                    onChange={(e) =>
                      setScores((s) => ({ ...s, [c.name]: Number(e.target.value) }))
                    }
                    className="h-1.5 flex-1 accent-[var(--primary)]"
                  />
                  <span className="w-6 text-center text-sm font-semibold text-text">
                    {scores[c.name]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-3">
            <p className="text-xs text-text-muted">Rating akhir (rata-rata)</p>
            <p className="text-xl font-semibold text-primary">
              {average.toFixed(2)} · {label.label}
            </p>
          </div>

          <Field label="Kelebihan" htmlFor="strength">
            <textarea
              id="strength"
              name="strength"
              rows={2}
              defaultValue={(existing?.strength as string) ?? ""}
              className="cr-input resize-y"
            />
          </Field>
          <Field label="Perlu diperbaiki" htmlFor="improvement">
            <textarea
              id="improvement"
              name="improvement"
              rows={2}
              defaultValue={(existing?.improvement as string) ?? ""}
              className="cr-input resize-y"
            />
          </Field>
          <Field label="Rekomendasi" htmlFor="recommendation">
            <select
              id="recommendation"
              name="recommendation"
              defaultValue={(existing?.recommendation as string) ?? ""}
              className="cr-input"
            >
              <option value="">Tidak ditentukan</option>
              <option value="rehire">Rekomendasikan untuk dipakai lagi</option>
              <option value="consider">Dipertimbangkan</option>
              <option value="do_not_rehire">Tidak direkomendasikan</option>
            </select>
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
