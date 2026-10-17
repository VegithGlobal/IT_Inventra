import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { listAssetTypes } from "@/features/master-data/queries";
import { AssetTypesView } from "@/features/master-data/views";
import { requireUser } from "@/lib/session";
import { getDepreciationDefaults } from "@/lib/settings";

export const metadata: Metadata = { title: "Asset types" };

async function Content() {
  const [user, rows, dep] = await Promise.all([requireUser(), listAssetTypes(), getDepreciationDefaults()]);
  return <AssetTypesView rows={rows} isAdmin={user.role === "ADMIN"} defaultSalvage={String(dep.defaultSalvagePercent)} />;
}

export default function AssetTypesPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={12} />}>
      <Content />
    </Suspense>
  );
}
