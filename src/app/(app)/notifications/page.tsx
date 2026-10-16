import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { NotificationsView } from "@/features/notifications/notifications-view";
import { listNotifications } from "@/features/notifications/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Notifications" };

async function Content() {
  const user = await requireUser();
  return <NotificationsView rows={await listNotifications(user.id)} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
