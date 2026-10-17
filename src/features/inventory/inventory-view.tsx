"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Boxes, MoreHorizontal, PackageMinus, PackagePlus, Plus, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NewItemForm, StockDialog, type StockMode, type StockTarget } from "./dialogs";
import type { InventoryLookups, ItemRow } from "./queries";

export function StockLevel({ quantity, min, unit }: { quantity: number; min: number; unit: string }) {
  const tone = quantity === 0 ? "danger" : quantity <= min ? "warning" : null;
  return (
    <span className="flex items-center justify-end gap-2 tabular">
      {tone && <Badge tone={tone}>{quantity === 0 ? "Out" : "Low"}</Badge>}
      <span className={cn("font-medium", tone === "danger" && "text-danger")}>
        {quantity} <span className="font-normal text-fg-muted">{unit}</span>
      </span>
    </span>
  );
}

export function InventoryView({
  rows,
  lookups,
  stats,
  canWrite,
}: {
  rows: ItemRow[];
  lookups: InventoryLookups;
  stats: { issuedThisMonth: number; issueCount: number; purchasedThisMonth: number };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [stock, setStock] = useState<{ target: StockTarget; mode: StockMode } | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const low = rows.filter((r) => r.low);
  const value = rows.reduce((s, r) => s + (r.stockValue ?? 0), 0);
  const data = lowOnly ? low : rows;
  const toTarget = (r: ItemRow): StockTarget => ({ id: r.id, name: r.name, unit: r.unit, quantity: r.quantity, unitCost: r.unitCost });

  const columns = useMemo<ColumnDef<ItemRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Item",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-80">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate font-mono text-[12px] text-fg-muted">{row.original.sku}</p>
          </div>
        ),
        meta: { csv: (r) => r.name },
      },
      { accessorKey: "sku", header: "SKU", meta: { csv: (r) => r.sku } },
      { accessorKey: "category", header: "Category", meta: { csv: (r) => r.category } },
      {
        accessorKey: "quantity",
        header: "On hand",
        cell: ({ row }) => <StockLevel quantity={row.original.quantity} min={row.original.minQuantity} unit={row.original.unit} />,
        meta: { align: "right", csv: (r) => r.quantity },
      },
      { accessorKey: "minQuantity", header: "Reorder at", meta: { align: "right", csv: (r) => r.minQuantity } },
      { accessorKey: "unitCost", header: "Unit cost", cell: ({ row }) => (row.original.unitCost === null ? "—" : formatMoney(row.original.unitCost)), meta: { align: "right", csv: (r) => r.unitCost?.toFixed(2) } },
      { accessorKey: "stockValue", header: "Value", cell: ({ row }) => (row.original.stockValue === null ? "—" : formatMoney(row.original.stockValue)), meta: { align: "right", csv: (r) => r.stockValue?.toFixed(2) } },
      { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.location } },
      { accessorKey: "vendor", header: "Vendor", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.vendor } },
      { accessorKey: "lastMovementAt", header: "Last movement", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.lastMovementAt), meta: { csv: (r) => (r.lastMovementAt ? new Date(r.lastMovementAt).toISOString() : "") } },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-40" },
        cell: ({ row }) =>
          canWrite && (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => setStock({ target: toTarget(row.original), mode: "out" })} disabled={row.original.quantity === 0}>
                Issue
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="More stock actions">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setStock({ target: toTarget(row.original), mode: "in" })}>
                    <PackagePlus /> Stock in
                  </MenuItem>
                  <MenuItem onSelect={() => setStock({ target: toTarget(row.original), mode: "out" })} disabled={row.original.quantity === 0}>
                    <PackageMinus /> Issue
                  </MenuItem>
                  <MenuItem onSelect={() => setStock({ target: toTarget(row.original), mode: "adjust" })}>
                    <SlidersHorizontal /> Adjust count
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ),
      },
    ],
    [canWrite],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Consumables and accessories tracked by quantity — mice, cables, toner, chargers."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus />
              New item
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Items" value={rows.length} sub={`${rows.reduce((s, r) => s + r.quantity, 0)} units on hand`} />
        <StatCard
          label="Low or out of stock"
          value={<span className={cn(low.length > 0 && "text-warning")}>{low.length}</span>}
          sub={low.length ? low.slice(0, 2).map((r) => r.name).join(", ") : "All above reorder point"}
        />
        <StatCard label="Stock value" value={formatMoneyShort(value)} sub="At last purchase cost" />
        <StatCard label="This month" value={`${stats.issuedThisMonth} issued`} sub={`${formatMoney(stats.purchasedThisMonth)} purchased`} />
      </div>
      <DataTable
        key={String(lowOnly)}
        data={data}
        columns={columns}
        searchPlaceholder="Search item, SKU, category…"
        exportName="inventory"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/inventory/${r.id}`)}
        initialHidden={{ sku: false, minQuantity: false, vendor: false, lastMovementAt: false }}
        filters={[
          { columnId: "category", label: "Category", options: [...new Set(rows.map((r) => r.category))].sort().map((c) => ({ value: c, label: c })) },
          { columnId: "location", label: "Location", options: [...new Set(rows.map((r) => r.location).filter((l): l is string => !!l))].sort().map((l) => ({ value: l, label: l })) },
        ]}
        toolbar={
          <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
            <input type="checkbox" className="size-4 accent-[var(--action)]" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Low stock only
          </label>
        }
        empty={
          <EmptyState
            icon={Boxes}
            title="No stock items yet"
            description="Add consumables you keep in the cupboard so you know when to reorder."
            action={canWrite && <Button variant="primary" onClick={() => setNewOpen(true)}>New item</Button>}
          />
        }
      />
      <SlideOver open={newOpen && canWrite} onOpenChange={setNewOpen} title="New stock item">
        <NewItemForm lookups={lookups} onDone={(r) => router.push(`/inventory/${r.id}`)} />
      </SlideOver>
      <StockDialog target={stock?.target ?? null} mode={stock?.mode ?? "out"} lookups={lookups} onOpenChange={(o) => !o && setStock(null)} />
    </div>
  );
}
