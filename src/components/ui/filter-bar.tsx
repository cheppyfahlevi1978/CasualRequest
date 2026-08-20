"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec {
  name: string;
  label: string;
  type: "select" | "date" | "text";
  options?: FilterOption[];
  placeholder?: string;
}

/**
 * Query-string driven filter bar.
 *
 * State lives in the URL, so filtered views are shareable and every list page
 * stays a Server Component that re-queries with the filter applied server-side
 * (PRD §9, §52).
 */
export function FilterBar({
  filters,
  children,
}: {
  filters: FilterSpec[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const submit = (formData: FormData) => {
    const next = new URLSearchParams();
    // Preserve query params this bar does not own (tab selection, scope, …)
    // so filtering never silently drops the surrounding view state.
    const owned = new Set(filters.map((f) => f.name));
    for (const [key, value] of params.entries()) {
      if (!owned.has(key) && key !== "page") next.set(key, value);
    }
    for (const f of filters) {
      const value = String(formData.get(f.name) ?? "").trim();
      if (value) next.set(f.name, value);
      else next.delete(f.name);
    }
    startTransition(() => {
      router.push(next.toString() ? `${pathname}?${next}` : pathname);
    });
  };

  const reset = () => {
    const kept = new URLSearchParams();
    const owned = new Set(filters.map((f) => f.name));
    for (const [key, value] of params.entries()) {
      if (!owned.has(key) && key !== "page") kept.set(key, value);
    }
    startTransition(() =>
      router.push(kept.toString() ? `${pathname}?${kept}` : pathname),
    );
  };

  const hasActive = filters.some((f) => params.get(f.name));

  return (
    <form
      action={submit}
      className="cr-card mb-5 flex flex-wrap items-end gap-3 p-4"
      aria-label="Filter"
    >
      {filters.map((f) => (
        <div key={f.name} className="min-w-[9rem] flex-1 sm:max-w-[13rem]">
          <label className="cr-label" htmlFor={`filter-${f.name}`}>
            {f.label}
          </label>
          {f.type === "select" ? (
            <select
              id={`filter-${f.name}`}
              name={f.name}
              defaultValue={params.get(f.name) ?? ""}
              className="cr-input h-9 py-0 text-xs"
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`filter-${f.name}`}
              name={f.name}
              type={f.type === "date" ? "date" : "search"}
              defaultValue={params.get(f.name) ?? ""}
              placeholder={f.placeholder}
              className="cr-input h-9 py-0 text-xs"
            />
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
          <Filter size={14} />
          {pending ? "Memuat…" : "Terapkan"}
        </button>
        {hasActive ? (
          <button type="button" onClick={reset} className={buttonClass("secondary", "sm")}>
            <RotateCcw size={14} />
            Reset
          </button>
        ) : null}
      </div>

      {children}
    </form>
  );
}
