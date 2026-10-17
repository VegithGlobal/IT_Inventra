import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { InventoryView } from "@/features/inventory/inventory-view";
import { getInventoryLookups, getInventoryStats, listItems } from "@/features/inventory/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Inventory" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups, stats] = await Promise.all([listItems(), getInventoryLookups(), getInventoryStats()]);
  return <InventoryView rows={rows} lookups={lookups} stats={stats} canWrite={canWrite(user.role)} />;
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-14" />
          <StatSkeleton />
          <PageSkeleton />
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
