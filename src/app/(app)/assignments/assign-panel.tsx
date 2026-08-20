"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Search } from "lucide-react";
import { assignCasuals, unassignCasual } from "@/server/actions/operations";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Badge, buttonClass } from "@/components/ui/primitives";
import { TALENT_CLASS_LABEL, TALENT_CLASS_TONE } from "@/lib/format";
import type { AssignmentRow, CasualRow } from "@/types/domain";

export function AssignPanel({
  requestId,
  requestNo,
  required,
  assigned,
  pool,
  currentAssignments,
  currency,
  canManage,
}: {
  requestId: string;
  requestNo: string;
  required: number;
  assigned: number;
  pool: CasualRow[];
  currentAssignments: AssignmentRow[];
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [term, setTerm] = React.useState("");
  const [onlyRecommended, setOnlyRecommended] = React.useState(false);

  const remaining = Math.max(required - assigned, 0);

  const alreadyAssigned = React.useMemo(
    () => new Set(currentAssignments.filter((a) => a.status !== "cancelled").map((a) => a.casual_id)),
    [currentAssignments],
  );

  const filtered = React.useMemo(() => {
    const t = term.trim().toLowerCase();
    return pool.filter((c) => {
      if (c.is_blacklisted || c.status !== "active") return false;
      if (alreadyAssigned.has(c.id)) return false;
      if (onlyRecommended && c.talent_class !== "recommended") return false;
      if (!t) return true;
      return (
        c.full_name.toLowerCase().includes(t) ||
        c.casual_no.toLowerCase().includes(t) ||
        (c.preferred_department_name ?? "").toLowerCase().includes(t) ||
        c.skills.some((s) => s.toLowerCase().includes(t))
      );
    });
  }, [pool, term, onlyRecommended, alreadyAssigned]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= remaining) {
        toast.push("warning", "Kuota terpenuhi", `Request ini hanya menyisakan ${remaining} slot.`);
        return cur;
      }
      return [...cur, id];
    });
  };

  const save = async () => {
    setBusy(true);
    const result = await assignCasuals(requestId, selected);
    setBusy(false);
    if (result.ok) {
      toast.success("Assignment tersimpan", result.message);
      setOpen(false);
      setSelected([]);
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  const remove = async (assignmentId: string) => {
    setBusy(true);
    const result = await unassignCasual(assignmentId);
    setBusy(false);
    if (result.ok) {
      toast.success("Dibatalkan", result.message);
      router.refresh();
    } else {
      toast.error("Gagal", result.error);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-text-muted">
          Required <strong className="text-text">{required}</strong> · Assigned{" "}
          <strong className="text-text">{assigned}</strong> · Remaining{" "}
          <strong className={remaining > 0 ? "text-warning" : "text-success"}>{remaining}</strong>
        </span>
        {canManage && remaining > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClass("primary", "sm")}
          >
            <UserPlus size={14} />
            Pilih casual
          </button>
        ) : null}
      </div>

      {currentAssignments.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {currentAssignments
            .filter((a) => a.status !== "cancelled")
            .map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-full border border-border bg-bg-subtle py-1 pl-3 pr-1.5 text-xs"
              >
                <span className="font-medium text-text">{a.casual_name}</span>
                <span className="text-text-faint">{a.casual_no}</span>
                {canManage && !["present", "completed"].includes(a.status) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(a.id)}
                    className="rounded-full p-1 text-text-faint transition hover:bg-danger-soft hover:text-danger"
                    aria-label={`Batalkan ${a.casual_name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Assign casual — ${requestNo}`}
        description={`Pilih maksimal ${remaining} casual dari talent pool. Casual dalam blacklist tidak ditampilkan.`}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-text-muted">
              {selected.length} dipilih dari {remaining} slot
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClass("secondary", "sm")}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void save()}
              className={buttonClass("primary", "sm")}
            >
              {busy ? "Menyimpan…" : "Simpan assignment"}
            </button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cari nama, ID, skill, department…"
              className="cr-input h-9 pl-9 text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={onlyRecommended}
              onChange={(e) => setOnlyRecommended(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong"
            />
            Hanya yang direkomendasikan
          </label>
        </div>

        <div className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-faint">
              Tidak ada casual yang cocok dengan filter ini.
            </p>
          ) : (
            filtered.map((c) => {
              const checked = selected.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    checked
                      ? "border-primary/40 bg-primary-soft"
                      : "border-border hover:bg-bg-subtle"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 rounded border-border-strong"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{c.full_name}</p>
                    <p className="truncate text-[11px] text-text-faint">
                      {c.casual_no} · {c.preferred_department_name ?? "Tanpa department"} ·{" "}
                      {c.skills.slice(0, 3).join(", ") || "tanpa skill"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={TALENT_CLASS_TONE[c.talent_class]}>
                      {TALENT_CLASS_LABEL[c.talent_class]}
                    </Badge>
                    <p className="mt-1 text-[11px] text-text-muted">
                      ★ {Number(c.avg_rating).toFixed(2)} · {Number(c.attendance_rate).toFixed(0)}%
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <p className="mt-3 text-[11px] text-text-faint">
          Rate per casual diambil dari rate request, atau dari rate master hotel bila request tidak
          menetapkan rate sendiri. Mata uang: {currency}.
        </p>
      </Modal>
    </>
  );
}
