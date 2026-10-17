import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page";
import { REPORTS } from "@/features/reports/definitions";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  const sections = ["Assets", "Finance", "Work", "Access"] as const;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Reports" description="Filter by date, group the way you need, and export to CSV, Excel or PDF." />
      {sections.map((section) => (
        <section key={section} className="flex flex-col gap-3">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">{section}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.filter((r) => r.section === section).map((r) => (
              <Link
                key={r.key}
                href={`/reports/${r.key}`}
                className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:bg-subtle"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-fg">{r.title}</span>
                  <span className="mt-0.5 block text-[13px] text-fg-muted">{r.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
