"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { Option } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { DOCUMENT_TYPE, toOptions } from "@/lib/options";
import { DocumentPreview, FileIcon, UploadDialog } from "./document-ui";
import type { DocumentLinkOptions, DocumentRow } from "./queries";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function DocumentsView({
  rows,
  vendors,
  linkOptions,
  canWrite,
}: {
  rows: DocumentRow[];
  vendors: Option[];
  linkOptions: DocumentLinkOptions;
  canWrite: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useQueryFlag("new");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = rows.find((r) => r.id === previewId) ?? null;

  const invoices = rows.filter((r) => r.type === "INVOICE" || r.type === "RECEIPT");
  const thisYear = new Date().getFullYear();
  const invoicedThisYear = invoices.filter((r) => r.invoiceDate && new Date(r.invoiceDate).getFullYear() === thisYear).reduce((s, r) => s + (r.amount ?? 0), 0);

  const columns = useMemo<ColumnDef<DocumentRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Document",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon mime={row.original.mimeType} />
            <div className="min-w-0 max-w-80">
              <p className="truncate font-medium">{row.original.title}</p>
              <p className="truncate text-[12.5px] text-fg-muted">{row.original.fileName}</p>
            </div>
          </div>
        ),
        meta: { csv: (r) => r.title },
      },
      { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge>{DOCUMENT_TYPE[row.original.type]}</Badge>, meta: { csv: (r) => DOCUMENT_TYPE[r.type] } },
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        cell: ({ getValue }) => <span className="font-mono text-[12.5px]">{String(getValue() ?? "—")}</span>,
        meta: { csv: (r) => r.invoiceNumber },
      },
      { accessorKey: "vendor", header: "Vendor", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.vendor } },
      {
        accessorKey: "invoiceDate",
        header: "Date",
        sortingFn: "datetime",
        cell: ({ row }) => formatDate(row.original.invoiceDate),
        meta: { csv: (r) => iso(r.invoiceDate) },
      },
      {
        id: "links",
        accessorFn: (r) => r.links.map((l) => l.label).join(" "),
        header: "Linked to",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.links.length ? (
            <span className="flex max-w-56 flex-wrap gap-x-2 text-[12.5px]">
              {row.original.links.map((l) => (
                <Link key={l.href} href={l.href} onClick={(e) => e.stopPropagation()} className="truncate text-fg-secondary hover:text-fg hover:underline">
                  {l.label}
                </Link>
              ))}
            </span>
          ) : (
            <span className="text-fg-muted">—</span>
          ),
        meta: { csv: (r) => r.links.map((l) => l.label).join("; ") },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (row.original.amount === null ? "—" : formatMoney(row.original.amount)),
        meta: { align: "right", csv: (r) => r.amount?.toFixed(2) },
      },
      { accessorKey: "createdAt", header: "Uploaded", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.createdAt), meta: { csv: (r) => iso(r.createdAt) } },
    ],
    [],
  );

  // Global search runs over column values; add a hidden haystack with formatted amount/date variants.
  const searchable = useMemo(
    () => rows.map((r) => ({ ...r, haystack: [r.amount?.toFixed(2), r.amount ? formatMoney(r.amount) : "", iso(r.invoiceDate), r.invoiceDate ? formatDate(r.invoiceDate) : "", r.notes].join(" ") })),
    [rows],
  );
  const allColumns = useMemo<ColumnDef<DocumentRow & { haystack: string }, unknown>[]>(
    () => [...(columns as ColumnDef<DocumentRow & { haystack: string }, unknown>[]), { accessorKey: "haystack", header: "Search", enableHiding: false, meta: { className: "hidden" } }],
    [columns],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices & documents"
        description="Every invoice, receipt, warranty card and contract in one searchable vault."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              <Upload />
              Upload
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Documents" value={rows.length} />
        <StatCard label="Invoices & receipts" value={invoices.length} />
        <StatCard label={`Invoiced in ${thisYear}`} value={formatMoneyShort(invoicedThisYear)} />
        <StatCard label="Unlinked" value={rows.filter((r) => r.links.length === 0).length} sub="Not attached to any record" />
      </div>
      <DataTable
        data={searchable}
        columns={allColumns}
        searchPlaceholder="Search invoice #, vendor, amount, date…"
        exportName="documents"
        getRowId={(r) => r.id}
        onRowClick={(r) => setPreviewId(r.id)}
        initialSorting={[{ id: "createdAt", desc: true }]}
        initialHidden={{ createdAt: false }}
        filters={[
          { columnId: "type", label: "Type", options: toOptions(DOCUMENT_TYPE) },
          { columnId: "vendor", label: "Vendor", options: [...new Set(rows.map((r) => r.vendor).filter((v): v is string => !!v))].sort().map((v) => ({ value: v, label: v })) },
        ]}
        empty={
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload invoices and warranty cards and link them to assets, subscriptions or expenses."
            action={canWrite && <Button variant="primary" onClick={() => setUploadOpen(true)}>Upload document</Button>}
          />
        }
      />
      <UploadDialog open={uploadOpen && canWrite} onOpenChange={setUploadOpen} vendors={vendors} linkOptions={linkOptions} />
      <DocumentPreview doc={preview} onOpenChange={(o) => !o && setPreviewId(null)} vendors={vendors} linkOptions={linkOptions} canWrite={canWrite} />
    </div>
  );
}
