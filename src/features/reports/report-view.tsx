"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { formatCell, totalsOf } from "./format";
import type { ReportMeta, ReportParams, ReportResult, ReportRow } from "./types";

function query(p: ReportParams) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) sp.set(k, v);
  return sp.toString();
}

async function exportExcel(meta: ReportMeta, result: ReportResult, params: ReportParams) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const cols = result.columns.filter((c) => c.label);
  const header = cols.map((c) => ({ value: c.label, fontWeight: "bold" as const }));
  const cell = (c: (typeof cols)[number], v: ReportRow[string]) => {
    if (v === null || v === undefined || v === "") return null;
    if (c.type === "money") return { value: v as number, format: "#,##0.00" };
    if (c.type === "percent") return { value: v as number, format: "0%" };
    if (c.type === "number") return { value: v as number, format: Number.isInteger(v) ? "#,##0" : "0.0" };
    if (c.type === "date") return { value: new Date(v as Date), format: "dd-mmm-yyyy" };
    if (c.type === "datetime") return { value: new Date(v as Date), format: "dd-mmm-yyyy hh:mm" };
    return { value: String(v) };
  };
  const totals = totalsOf(cols, result.rows);
  const hasTotals = Object.keys(totals).length > 0;
  const data = [
    header,
    ...result.rows.map((r) => cols.map((c) => cell(c, r[c.key]))),
    ...(hasTotals ? [cols.map((c, i) => (i === 0 ? { value: "Total", fontWeight: "bold" as const } : c.key in totals ? { ...cell(c, totals[c.key])!, fontWeight: "bold" as const } : null))] : []),
  ];
  const suffix = params.from && params.to ? `${params.from}-to-${params.to}` : (params.asOf ?? new Date().toISOString().slice(0, 10));
  await writeXlsxFile(data, { columns: cols.map((c) => ({ width: c.type === "text" ? 28 : 14 })), sheet: meta.title.slice(0, 31), stickyRowsCount: 1 }).toFile(`${meta.key}-${suffix}.xlsx`);
}

export function ReportView({ meta, params, result }: { meta: ReportMeta; params: ReportParams; result: ReportResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(params);
  const [busy, setBusy] = useState(false);
  const apply = (next: ReportParams) => router.replace(`${pathname}?${query(next)}`, { scroll: false });

  const columns = useMemo<ColumnDef<ReportRow, unknown>[]>(
    () =>
      result.columns.map((c) => ({
        id: c.key,
        accessorFn: (r) => {
          const v = r[c.key];
          return v instanceof Date ? v.getTime() : v;
        },
        header: c.label,
        sortingFn: c.type === "text" ? "alphanumeric" : "basic",
        sortUndefined: "last",
        cell: ({ row }) => {
          const text = formatCell(c.type, row.original[c.key]);
          const href = c.hrefKey ? row.original[c.hrefKey] : null;
          return href ? (
            <Link href={String(href)} className={cn("hover:underline", c.key === result.columns[0].key && "font-medium")}>
              {text}
            </Link>
          ) : (
            <span className={cn(c.key === result.columns[0].key && "font-medium", text === "—" && "text-fg-muted")}>{text}</span>
          );
        },
        meta: {
          label: c.label || c.key,
          align: ["money", "number", "percent"].includes(c.type) ? "right" : undefined,
          csv: (r: ReportRow) => {
            const v = r[c.key];
            if (v instanceof Date) return c.type === "datetime" ? v.toISOString() : v.toISOString().slice(0, 10);
            return typeof v === "number" && c.type === "money" ? v.toFixed(2) : (v as string | number | null);
          },
        },
      })),
    [result.columns],
  );

  const totals = totalsOf(result.columns, result.rows);
  const totalCols = result.columns.filter((c) => c.key in totals);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={meta.title}
        description={result.summary ?? meta.description}
        actions={
          <>
            <Button
              size="sm"
              disabled={busy || !result.rows.length}
              onClick={async () => {
                setBusy(true);
                try {
                  await exportExcel(meta, result, params);
                } catch (e) {
                  toast.error(`Excel export failed: ${e instanceof Error ? e.message : String(e)}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FileSpreadsheet />
              Excel
            </Button>
            <Button size="sm" asChild>
              <Link href={`/print/reports/${meta.key}?${query(params)}`} target="_blank">
                <Printer />
                PDF
              </Link>
            </Button>
          </>
        }
      />

      {(meta.params.dateRange || meta.params.groups || meta.params.asOf) && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          {meta.params.dateRange && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-secondary">{meta.params.dateRange.label}</span>
              <div className="flex items-center gap-1.5">
                <Input type="date" aria-label="From" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="h-9 w-40" />
                <span className="text-fg-muted">–</span>
                <Input type="date" aria-label="To" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="h-9 w-40" />
              </div>
            </div>
          )}
          {meta.params.asOf && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-secondary">As of</span>
              <Input type="date" value={draft.asOf} onChange={(e) => setDraft({ ...draft, asOf: e.target.value })} className="h-9 w-40" />
            </label>
          )}
          {meta.params.groups && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-fg-secondary">Group by</span>
              <NativeSelect
                value={draft.group}
                onChange={(e) => {
                  const next = { ...draft, group: e.target.value };
                  setDraft(next);
                  apply(next);
                }}
                className="w-44"
              >
                {meta.params.groups.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {(meta.params.dateRange || meta.params.asOf) && (
            <Button type="submit" variant="primary">
              Run report
            </Button>
          )}
        </form>
      )}

      {totalCols.length > 0 && result.rows.length > 0 && (
        <Card className="flex flex-wrap items-end gap-x-8 gap-y-3 px-5 py-4">
          <p className="w-full text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase sm:w-auto sm:self-center">Totals</p>
          {totalCols.map((c) => (
            <div key={c.key}>
              <p className="text-[12px] text-fg-muted">{c.label}</p>
              <p className="text-[18px] font-semibold text-fg tabular">{formatCell(c.type, totals[c.key])}</p>
            </div>
          ))}
        </Card>
      )}

      <DataTable
        key={result.columns.map((c) => c.key).join("|")}
        data={result.rows}
        columns={columns}
        searchPlaceholder="Search this report…"
        exportName={meta.key}
        pageSize={50}
        initialHidden={Object.fromEntries(result.columns.filter((c) => c.hidden).map((c) => [c.key, false]))}
        empty={<p className="flex items-center justify-center gap-2 px-4 py-12 text-[13.5px] text-fg-muted"><FileText className="size-4" /> No rows for these filters.</p>}
      />
    </div>
  );
}
