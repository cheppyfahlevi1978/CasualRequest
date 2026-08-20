"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export function PrintTrigger() {
  return (
    <div className="no-print mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => window.print()}
        className={buttonClass("primary", "sm")}
      >
        <Printer size={14} />
        Cetak / Simpan PDF
      </button>
    </div>
  );
}
