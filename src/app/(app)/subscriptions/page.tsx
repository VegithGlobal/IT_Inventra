import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { getLookups } from "@/features/employees/queries";
import { listSubscriptions } from "@/features/subscriptions/queries";
import { SubscriptionsView } from "@/features/subscriptions/subscriptions-view";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Subscriptions" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups] = await Promise.all([listSubscriptions(), getLookups()]);
  return <SubscriptionsView rows={rows} lookups={lookups} canWrite={canWrite(user.role)} />;
}

export default function SubscriptionsPage() {
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
