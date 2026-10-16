import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { AssetsView } from "@/features/assets/assets-view";
import { listAssets } from "@/features/assets/queries";
import { getLookups } from "@/features/employees/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Assets" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups] = await Promise.all([listAssets(), getLookups()]);
  return <AssetsView rows={rows} lookups={lookups} canWrite={canWrite(user.role)} />;
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      <Content />
    </Suspense>
  );
}
