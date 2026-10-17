"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { LICENSE_TYPE, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import { LicenseForm, SeatBar, emptyLicense } from "./license-ui";
import type { LicenseLookups, LicenseRow } from "./queries";

export function ExpiryLabel({ date, days }: { date: Date | null; days: number | null }) {
  if (!date || days === null) return <span className="text-fg-muted">Perpetual</span>;
  return (
    <span className="flex flex-col">
      <span className="tabular">{formatDate(date)}</span>
      {days < 0 ? (
        <span>
          <Badge tone="danger" dot>
            Expired
          </Badge>
        </span>
      ) : days <= 30 ? (
        <span className="text-[12.5px] font-medium text-warning">In {days} days</span>
      ) : null}
    </span>
  );
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const columns: ColumnDef<LicenseRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "License",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-80">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-[12.5px] text-fg-muted">{row.original.vendor ?? row.original.subscription?.name ?? "—"}</p>
      </div>
    ),
    meta: { csv: (r) => r.name },
  },
  { accessorKey: "type", header: "Type", cell: ({ row }) => LICENSE_TYPE[row.original.type], meta: { csv: (r) => LICENSE_TYPE[r.type] } },
  {
    id: "seats",
    accessorFn: (r) => (r.type === "SITE" ? 0 : r.usedSeats / Math.max(1, r.totalSeats)),
    header: "Seats",
    cell: ({ row }) => <SeatBar used={row.original.usedSeats} total={row.original.totalSeats} site={row.original.type === "SITE"} />,
    meta: { label: "Seats used", csv: (r) => `${r.usedSeats}/${r.totalSeats}` },
  },
  {
    accessorKey: "expiryDate",
    header: "Expiry",
    sortingFn: "datetime",
    cell: ({ row }) => <ExpiryLabel date={row.original.expiryDate} days={row.original.daysToExpiry} />,
    meta: { csv: (r) => iso(r.expiryDate) },
  },
  { accessorKey: "vendor", header: "Vendor", meta: { csv: (r) => r.vendor } },
  { accessorKey: "purchaseDate", header: "Purchased", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.purchaseDate), meta: { csv: (r) => iso(r.purchaseDate) } },
  { accessorKey: "cost", header: "Cost", cell: ({ row }) => (row.original.cost === null ? "—" : formatMoney(row.original.cost)), meta: { align: "right", csv: (r) => r.cost?.toFixed(2) } },
];

export function LicensesView({ rows, lookups, canWrite }: { rows: LicenseRow[]; lookups: LicenseLookups; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  const counted = rows.filter((r) => r.type !== "SITE");
  const used = counted.reduce((s, r) => s + r.usedSeats, 0);
  const total = counted.reduce((s, r) => s + r.totalSeats, 0);
  const expiring = rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30);
  const expired = rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry < 0);
  const full = counted.filter((r) => r.usedSeats >= r.totalSeats);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Software licenses"
        description="Seats, keys and expiry for software you've bought."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus />
              New license
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Licenses" value={rows.length} sub={formatMoneyShort(rows.reduce((s, r) => s + (r.cost ?? 0), 0)) + " total cost"} />
        <StatCard label="Seats in use" value={`${used} / ${total}`} sub={`${total - used} free`} />
        <StatCard label="Expiring in 30 days" value={<span className={cn(expiring.length > 0 && "text-warning")}>{expiring.length}</span>} sub={expired.length ? `${expired.length} already expired` : undefined} />
        <StatCard label="Fully used" value={full.length} sub={full.length ? full.map((r) => r.name).join(", ") : "Every license has free seats"} />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search licenses, vendors…"
        exportName="licenses"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/licenses/${r.id}`)}
        initialHidden={{ vendor: false, purchaseDate: false }}
        filters={[{ columnId: "type", label: "Type", options: toOptions(LICENSE_TYPE) }]}
        empty={
          <EmptyState
            icon={KeyRound}
            title="No licenses yet"
            description="Track per-user and per-device licenses so you know who has a seat and when it expires."
            action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>New license</Button>}
          />
        }
      />
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New license">
        <LicenseForm initial={emptyLicense()} lookups={lookups} onDone={(r) => router.push(`/licenses/${r.id}`)} />
      </SlideOver>
    </div>
  );
}
