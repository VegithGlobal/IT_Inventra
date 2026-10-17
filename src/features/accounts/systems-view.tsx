"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Blocks, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { SYSTEM_CATEGORY, toOptions } from "@/lib/options";
import { SystemForm, emptySystem } from "./account-ui";
import type { AccountLookups, SystemRow } from "./queries";

const columns: ColumnDef<SystemRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "System",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-72">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-[12.5px] text-fg-muted">{row.original.loginUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? row.original.vendor ?? "—"}</p>
      </div>
    ),
    meta: { csv: (r) => r.name },
  },
  { id: "category", accessorFn: (r) => r.category, header: "Category", cell: ({ row }) => SYSTEM_CATEGORY[row.original.category], meta: { csv: (r) => SYSTEM_CATEGORY[r.category] } },
  { accessorKey: "active", header: "Active logins", meta: { align: "right", csv: (r) => r.active } },
  {
    accessorKey: "leavers",
    header: "Leavers to block",
    cell: ({ row }) => (row.original.leavers ? <span className="font-medium text-danger">{row.original.leavers}</span> : <span className="text-fg-muted">0</span>),
    meta: { align: "right", csv: (r) => r.leavers },
  },
  {
    accessorKey: "noMfa",
    header: "No 2FA",
    cell: ({ row }) => (row.original.noMfa ? <span className="font-medium text-warning">{row.original.noMfa}</span> : <span className="text-fg-muted">0</span>),
    meta: { align: "right", csv: (r) => r.noMfa },
  },
  { accessorKey: "total", header: "All-time", meta: { align: "right", csv: (r) => r.total } },
  { accessorKey: "vendor", header: "Vendor", cell: ({ getValue }) => (getValue() as string | null) ?? "—", meta: { csv: (r) => r.vendor } },
];

export function SystemsView({ rows, lookups, canWrite }: { rows: SystemRow[]; lookups: AccountLookups; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Systems"
        description="Everything people sign in to. Add how to block a user once, and it shows on every leaver's checklist."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus />
              New system
            </Button>
          )
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search systems…"
        exportName="systems"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/accounts/systems/${r.id}`)}
        initialHidden={{ vendor: false }}
        filters={[{ columnId: "category", label: "Category", options: toOptions(SYSTEM_CATEGORY) }]}
        empty={
          <EmptyState
            icon={Blocks}
            title="No systems yet"
            description="Add the services your team signs in to: company email, Google, Microsoft 365, Tally, AWS, VPN…"
            action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>New system</Button>}
          />
        }
      />
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New system">
        <SystemForm initial={emptySystem()} vendors={lookups.vendors} onDone={(r) => router.push(`/accounts/systems/${r.id}`)} />
      </SlideOver>
    </div>
  );
}
