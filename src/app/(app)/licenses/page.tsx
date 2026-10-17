import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { LicensesView } from "@/features/licenses/licenses-view";
import { getLicenseLookups, listLicenses } from "@/features/licenses/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Licenses" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups] = await Promise.all([listLicenses(), getLicenseLookups()]);
  return <LicensesView rows={rows} lookups={lookups} canWrite={canWrite(user.role)} />;
}

export default function LicensesPage() {
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
