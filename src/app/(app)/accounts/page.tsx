import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { AccountsView } from "@/features/accounts/accounts-view";
import { getAccountLookups, listAccounts, listOpenLeavers } from "@/features/accounts/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Accounts & logins" };

async function Content() {
  const user = await requireUser();
  const [rows, leavers, lookups] = await Promise.all([listAccounts(), listOpenLeavers(), getAccountLookups()]);
  return <AccountsView rows={rows} leavers={leavers} lookups={lookups} canWrite={canWrite(user.role)} />;
}

export default function AccountsPage() {
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
