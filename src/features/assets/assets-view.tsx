"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { LayoutGrid, Laptop, List, Plus, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CsvImport } from "@/components/csv-import";
import { DataTable } from "@/components/data-table/data-table";
import { useActionRunner } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDate, formatMoney } from "@/lib/format";
import { ASSET_CONDITION, ASSET_STATUS, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { Lookups } from "@/features/employees/queries";
import { bulkSetStatus, importAssets } from "./actions";
import { AssetForm } from "./asset-form";
import type { AssetRow } from "./queries";
import { ASSET_CSV_HEADERS, MANUAL_STATUSES } from "./schema";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const columns: ColumnDef<AssetRow, unknown>[] = [
  {
    accessorKey: "assetTag",
    header: "Tag",
    cell: ({ getValue }) => <span className="font-mono text-[12.5px] font-medium">{String(getValue())}</span>,
    meta: { csv: (r) => r.assetTag },
  },
  {
    accessorKey: "name",
    header: "Asset",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-72">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-[12.5px] text-fg-muted">{row.original.serialNumber ?? "No serial"}</p>
      </div>
    ),
    meta: { csv: (r) => r.name },
  },
  { accessorKey: "type", header: "Type", meta: { csv: (r) => r.type } },
  { accessorKey: "serialNumber", header: "Serial", meta: { csv: (r) => r.serialNumber } },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge tone={ASSET_STATUS[row.original.status].tone} dot>
        {ASSET_STATUS[row.original.status].label}
      </Badge>
    ),
    meta: { csv: (r) => ASSET_STATUS[r.status].label },
  },
  {
    accessorKey: "holder",
    header: "Assigned to",
    cell: ({ row }) =>
      row.original.holder ? (
        <span className="flex items-center gap-2">
          <Avatar name={row.original.holder} size="xs" />
          <span className="truncate">{row.original.holder}</span>
        </span>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
    meta: { csv: (r) => r.holder },
  },
  { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.location } },
  { accessorKey: "department", header: "Department", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.department } },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => ASSET_CONDITION[row.original.condition].label,
    meta: { csv: (r) => ASSET_CONDITION[r.condition].label },
  },
  { accessorKey: "vendor", header: "Vendor", meta: { csv: (r) => r.vendor } },
  {
    accessorKey: "purchaseDate",
    header: "Purchased",
    sortingFn: "datetime",
    cell: ({ row }) => formatDate(row.original.purchaseDate),
    meta: { csv: (r) => iso(r.purchaseDate) },
  },
  {
    accessorKey: "warrantyEnd",
    header: "Warranty",
    sortingFn: "datetime",
    cell: ({ row }) => {
      const end = row.original.warrantyEnd;
      if (!end) return <span className="text-fg-muted">—</span>;
      const expired = new Date(end) < new Date();
      return <span className={cn(expired && "text-fg-muted line-through decoration-fg-muted/50")}>{formatDate(end)}</span>;
    },
    meta: { csv: (r) => iso(r.warrantyEnd) },
  },
  {
    accessorKey: "purchaseCost",
    header: "Cost",
    cell: ({ row }) => (row.original.purchaseCost === null ? "—" : formatMoney(row.original.purchaseCost)),
    meta: { align: "right", csv: (r) => r.purchaseCost?.toFixed(2) },
  },
  {
    accessorKey: "bookValue",
    header: "Book value",
    cell: ({ row }) => (row.original.purchaseCost === null ? "—" : formatMoney(row.original.bookValue)),
    meta: { align: "right", csv: (r) => r.bookValue.toFixed(2) },
  },
];

function AssetCard({ a }: { a: AssetRow }) {
  return (
    <Link
      href={`/assets/${a.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-subtle"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[12px] text-fg-muted">{a.assetTag}</span>
        <Badge tone={ASSET_STATUS[a.status].tone} dot>
          {ASSET_STATUS[a.status].label}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-fg">{a.name}</p>
        <p className="truncate text-[12.5px] text-fg-muted">
          {a.type} · {a.location ?? "No location"}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[12.5px]">
        {a.holder ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={a.holder} size="xs" />
            <span className="truncate text-fg-secondary">{a.holder}</span>
          </span>
        ) : (
          <span className="text-fg-muted">Unassigned</span>
        )}
        <span className="shrink-0 text-fg-secondary tabular">{a.purchaseCost === null ? "" : formatMoney(a.bookValue)}</span>
      </div>
    </Link>
  );
}

function GridView({ rows }: { rows: AssetRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.assetTag, r.name, r.serialNumber, r.holder, r.type, r.location].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, serial, person…" className="bg-surface pl-9" aria-label="Search assets" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((a) => (
          <AssetCard key={a.id} a={a} />
        ))}
      </div>
      {filtered.length === 0 && <p className="py-10 text-center text-[13.5px] text-fg-muted">No assets match “{q}”.</p>}
    </div>
  );
}

export function AssetsView({ rows, lookups, canWrite }: { rows: AssetRow[]; lookups: Lookups; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  const [view, setView] = useState<"table" | "grid">("table");
  const { pending, run } = useActionRunner();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assets"
        description={`${rows.length} hardware assets with tags, holders and book value.`}
        actions={
          <>
            <div className="flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label="View">
              {(["table", "grid"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={v === "table" ? "Table view" : "Grid view"}
                  className={cn("flex size-7 items-center justify-center rounded text-fg-muted", view === v && "bg-subtle text-fg")}
                >
                  {v === "table" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
                </button>
              ))}
            </div>
            {canWrite && (
              <>
                <CsvImport
                  entity="Asset"
                  headers={ASSET_CSV_HEADERS}
                  example={["Dell Latitude 5440", "Laptop", "Dell", "Latitude 5440", "5CG1234XYZ", "2026-04-01", "78500", "Dell Technologies India", "INV/2026/1234", "2029-04-01", "Pune HQ · Floor 3", "NEW", ""]}
                  action={importAssets}
                />
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plus />
                  New asset
                </Button>
              </>
            )}
          </>
        }
      />
      {view === "grid" ? (
        <GridView rows={rows} />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search tag, serial, person…"
          exportName="assets"
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/assets/${r.id}`)}
          initialHidden={{ serialNumber: false, department: false, condition: false, vendor: false, purchaseDate: false, purchaseCost: false }}
          filters={[
            { columnId: "status", label: "Status", options: toOptions(ASSET_STATUS) },
            { columnId: "type", label: "Type", options: lookups.assetTypes.map((t) => ({ value: t.name, label: t.name })) },
            { columnId: "location", label: "Location", options: lookups.locations.map((l) => ({ value: l.name, label: l.name })) },
            { columnId: "department", label: "Department", options: lookups.departments.map((d) => ({ value: d.name, label: d.name })) },
          ]}
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" asChild>
                <Link href={`/print/labels?ids=${selected.map((a) => a.id).join(",")}`} target="_blank">
                  <Printer />
                  Print labels
                </Link>
              </Button>
              {canWrite && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="sm" disabled={pending}>
                      Change status
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="start">
                    <MenuLabel>Assigned assets are skipped</MenuLabel>
                    {MANUAL_STATUSES.map((s) => (
                      <MenuItem
                        key={s}
                        onSelect={() =>
                          run(() => bulkSetStatus({ ids: selected.map((a) => a.id), status: s }), undefined, (r) => {
                            clear();
                            toast.success(`${r.updated} updated${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
                          })
                        }
                      >
                        {ASSET_STATUS[s].label}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              )}
            </>
          )}
          empty={
            <EmptyState
              icon={Laptop}
              title="No assets yet"
              description="Add laptops, monitors and network gear, or import them from a spreadsheet."
              action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add asset</Button>}
            />
          }
        />
      )}
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New asset" description="A tag is generated from the type prefix.">
        <AssetForm lookups={lookups} onDone={(r) => router.push(`/assets/${r.id}`)} />
      </SlideOver>
    </div>
  );
}
