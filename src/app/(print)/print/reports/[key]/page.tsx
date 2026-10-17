import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { formatCell, totalsOf } from "@/features/reports/format";
import { getReportDef, resolveParams } from "@/features/reports/definitions";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report" };

async function Content({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const def = getReportDef(key);
  if (!def) notFound();
  const p = resolveParams(def, sp);
  const [result, company] = await Promise.all([def.run(p), getCompany()]);
  const cols = result.columns.filter((c) => c.label && !c.hidden);
  const totals = totalsOf(cols, result.rows);
  const numeric = (t: string) => ["money", "number", "percent"].includes(t);
  const filters = [
    def.params.dateRange && p.from && `${def.params.dateRange.label}: ${p.from} → ${p.to}`,
    def.params.asOf && `As of ${p.asOf}`,
    def.params.groups && `Grouped by ${def.params.groups.find((g) => g.value === p.group)?.label}`,
  ].filter(Boolean);

  return (
    <>
      <PrintBar title={def.title} hint="Landscape works best for wide reports. Use “Save as PDF” to keep a copy." />
      <article className="mx-auto my-8 w-full max-w-[1123px] bg-surface p-10 shadow-[var(--shadow-popover)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-fg pb-4">
          <div className="flex items-start gap-3">
            {company.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset
              <img src="/api/branding/logo" alt="" className="h-10 w-auto max-w-24 object-contain" />
            )}
            <div>
            <p className="text-[12px] tracking-[0.04em] text-fg-muted uppercase">{company.name}</p>
            <h1 className="mt-1 text-[20px] font-semibold text-fg">{def.title}</h1>
            {result.summary && <p className="mt-0.5 text-[12.5px] text-fg-secondary">{result.summary}</p>}
            </div>
          </div>
          <div className="text-right text-[11.5px] text-fg-secondary">
            {filters.map((f) => (
              <p key={String(f)}>{f}</p>
            ))}
            <p>
              Generated {formatDateTime(new Date())} by {user.name}
            </p>
          </div>
        </header>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-fg">
              {cols.map((c) => (
                <th key={c.key} className={cn("px-1.5 py-1.5 text-left font-semibold text-fg", numeric(c.type) && "text-right")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className="border-b border-line break-inside-avoid">
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-1.5 py-1 align-top text-fg", numeric(c.type) && "text-right tabular")}>
                    {formatCell(c.type, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-fg font-semibold">
                {cols.map((c, i) => (
                  <td key={c.key} className={cn("px-1.5 py-1.5 text-fg", numeric(c.type) && "text-right tabular")}>
                    {i === 0 ? "Total" : c.key in totals ? formatCell(c.type, totals[c.key]) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {result.rows.length === 0 && <p className="py-10 text-center text-[13px] text-fg-muted">No rows for these filters.</p>}
      </article>
    </>
  );
}

export default function PrintReportPage(props: PageProps<"/print/reports/[key]">) {
  return (
    <Suspense>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
