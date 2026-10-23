"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { LayoutGrid, Laptop, List, Plus, Printer, Search, Trash2 } from "lucide-react";
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
import { Modal, SlideOver } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDate, formatMoney } from "@/lib/format";
import { ASSET_CONDITION, ASSET_STATUS } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { Lookups } from "@/features/employees/queries";
import { bulkSetStatus, deleteAssets, importAssets } from "./actions";
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
  {
    id: "previousUsers",
    accessorFn: (r) => r.previousUsers.join(", "),
    header: "Previous users",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.previousUsers.length ? (
        <span className="line-clamp-2 max-w-64 text-fg-secondary">{row.original.previousUsers.join(", ")}</span>
      ) : null,
    meta: { csv: (r) => r.previousUsers.join(", ") },
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
        {a.previousUsers.length > 0 && <p className="mt-1 truncate text-[12.5px] text-fg-muted">Previously: {a.previousUsers.join(", ")}</p>}
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
    return rows.filter((r) => [r.assetTag, r.name, r.serialNumber, r.holder, r.type, r.location, ...r.previousUsers].some((v) => v?.toLowerCase().includes(s)));
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

type Filters = { status: string; type: string; location: string };
const NO_FILTERS: Filters = { status: "", type: "", location: "" };

/** Plain dropdowns over the list; options come from the assets actually there. */
function FilterBar({ rows, value, onChange }: { rows: AssetRow[]; value: Filters; onChange: (v: Filters) => void }) {
  const distinct = (pick: (r: AssetRow) => string | null) => [...new Set(rows.map(pick).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  const statuses = (Object.keys(ASSET_STATUS) as AssetRow["status"][]).filter((s) => rows.some((r) => r.status === s));
  const selects: { key: keyof Filters; label: string; options: { value: string; label: string }[] }[] = [
    { key: "status", label: "All statuses", options: statuses.map((s) => ({ value: s, label: ASSET_STATUS[s].label })) },
    { key: "type", label: "All types", options: distinct((r) => r.type).map((t) => ({ value: t, label: t })) },
    { key: "location", label: "All locations", options: distinct((r) => r.location).map((l) => ({ value: l, label: l })) },
  ];
  const active = Object.values(value).some(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selects.map((f) => (
        <NativeSelect
          key={f.key}
          value={value[f.key]}
          onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          aria-label={f.label}
          className="w-auto min-w-40 bg-surface"
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ))}
      {active && (
        <button type="button" className="text-[13px] font-medium text-fg-secondary hover:text-fg" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  );
}

export function AssetsView({
  rows,
  lookups,
  canWrite,
  canDelete,
  initialStatus = "",
}: {
  rows: AssetRow[];
  lookups: Lookups;
  canWrite: boolean;
  canDelete: boolean;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  const [view, setView] = useState<"table" | "grid">("table");
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, status: initialStatus });
  const [toDelete, setToDelete] = useState<{ rows: AssetRow[]; clear: () => void } | null>(null);
  const { pending, run } = useActionRunner();
  const shown = useMemo(
    () =>
      rows.filter(
        (r) => (!filters.status || r.status === filters.status) && (!filters.type || r.type === filters.type) && (!filters.location || r.location === filters.location),
      ),
    [rows, filters],
  );
  const deleteCount = toDelete?.rows.length ?? 0;
  const assignedCount = toDelete?.rows.filter((r) => r.holder).length ?? 0;

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
      {rows.length > 0 && <FilterBar rows={rows} value={filters} onChange={setFilters} />}
      {view === "grid" ? (
        <GridView rows={shown} />
      ) : (
        <DataTable
          data={shown}
          columns={columns}
          searchPlaceholder="Search tag, serial, person…"
          exportName="assets"
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/assets/${r.id}`)}
          initialHidden={{ serialNumber: false, department: false, condition: false, vendor: false, purchaseDate: false, purchaseCost: false }}
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
              {canDelete && (
                <Button size="sm" variant="danger" disabled={pending} onClick={() => setToDelete({ rows: selected, clear })}>
                  <Trash2 />
                  Delete
                </Button>
              )}
            </>
          )}
          empty={
            rows.length === 0 && (
            <EmptyState
              icon={Laptop}
              title="No assets yet"
              description="Add laptops, monitors and network gear, or import them from a spreadsheet."
              action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add asset</Button>}
            />
            )
          }
        />
      )}
      <Modal
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={deleteCount === 1 ? `Delete ${toDelete?.rows[0].assetTag} permanently?` : `Delete ${deleteCount} assets permanently?`}
        size="sm"
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                toDelete &&
                run(() => deleteAssets({ ids: toDelete.rows.map((a) => a.id) }), undefined, (r) => {
                  toDelete.clear();
                  setToDelete(null);
                  toast.success(`${r.deleted} asset${r.deleted === 1 ? "" : "s"} deleted`);
                })
              }
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-secondary">
          Removes {deleteCount === 1 ? "the asset" : "these assets"} with assignment history, repairs and documents. This can&apos;t be undone.
          {assignedCount > 0 && ` ${assignedCount} ${assignedCount === 1 ? "is" : "are"} currently assigned to someone.`}
        </p>
      </Modal>
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New asset" description="A tag is generated from the type prefix.">
        <AssetForm lookups={lookups} onDone={(r) => router.push(`/assets/${r.id}`)} />
      </SlideOver>
    </div>
  );
}
