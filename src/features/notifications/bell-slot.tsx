import { Bell } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { BellView } from "./bell";
import { getBellData } from "./queries";

async function BellData() {
  const user = await getCurrentUser();
  if (!user) return null;
  const data = await getBellData(user.id);
  return <BellView unread={data.unread} latest={data.latest} />;
}

/** Server slot for the top bar: streams the bell in once the session is read. */
export function NotificationBell() {
  return (
    <Suspense
      fallback={
        <span className="flex size-9 items-center justify-center text-fg-muted" aria-hidden>
          <Bell className="size-4" strokeWidth={1.75} />
        </span>
      }
    >
      <BellData />
    </Suspense>
  );
}
