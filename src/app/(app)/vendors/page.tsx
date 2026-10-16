import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { listVendors } from "@/features/vendors/queries";
import { VendorsView } from "@/features/vendors/vendors-view";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Vendors" };

async function Content() {
  const user = await requireUser();
  const rows = await listVendors();
  return <VendorsView rows={rows} canWrite={canWrite(user.role)} />;
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
