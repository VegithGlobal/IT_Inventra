import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { listAssetTypes } from "@/features/master-data/queries";
import { AssetTypesView } from "@/features/master-data/views";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Asset types" };

async function Content() {
  const [user, rows] = await Promise.all([requireUser(), listAssetTypes()]);
  return <AssetTypesView rows={rows} isAdmin={user.role === "ADMIN"} />;
}

export default function AssetTypesPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={12} />}>
      <Content />
    </Suspense>
  );
}
