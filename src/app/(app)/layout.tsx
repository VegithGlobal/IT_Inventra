import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { UserCardView } from "@/components/shell/user-card";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationBell } from "@/features/notifications/bell-slot";
import { QuickTicketSlot } from "@/features/tickets/quick-add-slot";
import { requireUser } from "@/lib/session";

async function UserCard() {
  const user = await requireUser();
  return <UserCardView name={user.name} role={user.role} />;
}

function UserCardSlot() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-full" />}>
      <UserCard />
    </Suspense>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar userCard={<UserCardSlot />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userCard={<UserCardSlot />} bell={<NotificationBell />} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <QuickTicketSlot />
      </div>
    </div>
  );
}
