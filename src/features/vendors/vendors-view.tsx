"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatMoney } from "@/lib/format";
import { vendorCategoryLabel, vendorCategoryOptions } from "@/lib/options";
import type { VendorRow } from "./queries";
import { VendorForm } from "./vendor-form";

const columns: ColumnDef<VendorRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Vendor",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        {row.original.gstin && <p className="truncate font-mono text-[12px] text-fg-muted">{row.original.gstin}</p>}
      </div>
    ),
    meta: { csv: (r) => r.name },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <Badge>{vendorCategoryLabel(row.original.category)}</Badge>,
    meta: { csv: (r) => vendorCategoryLabel(r.category) },
  },
  {
    accessorKey: "contactPerson",
    header: "Contact",
    cell: ({ row }) => (
      <div className="min-w-0 text-[13px]">
        <p className="truncate">{row.original.contactPerson ?? "—"}</p>
        <p className="truncate text-fg-muted">{row.original.phone ?? row.original.email ?? ""}</p>
      </div>
    ),
    meta: { csv: (r) => r.contactPerson },
  },
  { accessorKey: "phone", header: "Phone", meta: { csv: (r) => r.phone } },
  { accessorKey: "email", header: "Email", meta: { csv: (r) => r.email } },
  { accessorKey: "gstin", header: "GSTIN", meta: { csv: (r) => r.gstin } },
  { accessorKey: "assetCount", header: "Assets", meta: { align: "right", csv: (r) => r.assetCount } },
  { accessorKey: "subscriptionCount", header: "Active subs", meta: { align: "right", label: "Active subscriptions", csv: (r) => r.subscriptionCount } },
  {
    accessorKey: "totalSpend",
    header: "Total spend",
    cell: ({ row }) => formatMoney(row.original.totalSpend),
    meta: { align: "right", csv: (r) => r.totalSpend.toFixed(2) },
  },
];

export function VendorsView({ rows, categories, canWrite }: { rows: VendorRow[]; categories: string[]; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vendors"
        description="ISPs, cloud providers, hardware suppliers and service centres."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus />
              New vendor
            </Button>
          )
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search vendors, GSTIN, contact…"
        exportName="vendors"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/vendors/${r.id}`)}
        initialHidden={{ phone: false, email: false, gstin: false }}
        initialSorting={[{ id: "totalSpend", desc: true }]}
        filters={[{ columnId: "category", label: "Category", options: vendorCategoryOptions(categories) }]}
        empty={
          <EmptyState
            icon={Building2}
            title="No vendors yet"
            description="Vendors link assets, subscriptions and expenses so you can see spend per supplier."
            action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add vendor</Button>}
          />
        }
      />
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New vendor">
        <VendorForm categories={categories} onDone={(id) => router.push(`/vendors/${id}`)} />
      </SlideOver>
    </div>
  );
}
