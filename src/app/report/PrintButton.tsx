"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-secondary text-sm py-2 print:hidden">
      <Printer className="w-4 h-4" /> Print / Save PDF
    </button>
  );
}
