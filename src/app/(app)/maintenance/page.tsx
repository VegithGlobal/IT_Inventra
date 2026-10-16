import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { MaintenanceView } from "@/features/maintenance/maintenance-view";
import { getMaintenanceLookups, getMaintenanceStats, listMaintenance, listPreventiveSchedules } from "@/features/maintenance/queries";
import { getReminderLinkOptions } from "@/features/reminders/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Maintenance" };

async function Content() {
  const user = await requireUser();
  const [rows, schedules, lookups, reminderLinks, stats] = await Promise.all([
    listMaintenance(),
    listPreventiveSchedules(),
    getMaintenanceLookups(),
    getReminderLinkOptions(),
    getMaintenanceStats(),
  ]);
  return <MaintenanceView rows={rows} schedules={schedules} lookups={lookups} reminderLinks={reminderLinks} fySpend={stats.fySpend} canWrite={canWrite(user.role)} />;
}

export default function MaintenancePage() {
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
