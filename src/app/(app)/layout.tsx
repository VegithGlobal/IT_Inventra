import { Suspense } from "react";
import { BrandMark } from "@/components/shell/brand";
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
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-action px-3 py-2 text-[13px] font-medium text-action-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar userCard={<UserCardSlot />} brand={<BrandMark />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userCard={<UserCardSlot />} bell={<NotificationBell />} brand={<BrandMark />} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-24 outline-none sm:pb-6 md:px-8 md:py-8">{children}</main>
        <QuickTicketSlot />
      </div>
    </div>
  );
}
