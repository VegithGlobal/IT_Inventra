import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { getAccountLookups, listSystems } from "@/features/accounts/queries";
import { SystemsView } from "@/features/accounts/systems-view";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Systems" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups] = await Promise.all([listSystems(), getAccountLookups()]);
  return <SystemsView rows={rows} lookups={lookups} canWrite={canWrite(user.role)} />;
}

export default function SystemsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
