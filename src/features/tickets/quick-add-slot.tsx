import { Suspense } from "react";
import { canWrite, getCurrentUser } from "@/lib/session";
import { getTicketLookups } from "./queries";
import { QuickTicket } from "./quick-add";

async function QuickTicketData() {
  const user = await getCurrentUser();
  if (!user || !canWrite(user.role)) return null;
  return <QuickTicket lookups={await getTicketLookups()} canWrite />;
}

/** Mounted once in the app layout so "N" works on every page. */
export function QuickTicketSlot() {
  return (
    <Suspense fallback={null}>
      <QuickTicketData />
    </Suspense>
  );
}
