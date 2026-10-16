import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { getNotificationStats, getReminderLinkOptions, getUpcoming, listReminders } from "@/features/reminders/queries";
import { RemindersView } from "@/features/reminders/reminders-view";
import { emailConfigured } from "@/lib/email";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Reminders" };

async function Content() {
  const user = await requireUser();
  const [rows, upcoming, links, stats] = await Promise.all([listReminders(), getUpcoming(30), getReminderLinkOptions(), getNotificationStats()]);
  return <RemindersView rows={rows} upcoming={upcoming} links={links} stats={{ ...stats, emailOn: emailConfigured() }} canWrite={canWrite(user.role)} />;
}

export default function RemindersPage() {
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
