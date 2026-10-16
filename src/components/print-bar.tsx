"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintBar({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3 print:hidden">
      <div>
        <p className="text-[14px] font-medium text-fg">{title}</p>
        <p className="text-[12.5px] text-fg-muted">{hint ?? "Use “Save as PDF” in the print dialog to keep a PDF copy."}</p>
      </div>
      <Button variant="primary" onClick={() => window.print()}>
        <Printer />
        Print / Save PDF
      </Button>
    </div>
  );
}
