import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { getTicketMetrics, listTickets } from "@/features/tickets/queries";
import { TicketsView } from "@/features/tickets/tickets-view";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tickets" };

async function Content() {
  const user = await requireUser();
  const [rows, metrics] = await Promise.all([listTickets(), getTicketMetrics()]);
  return <TicketsView rows={rows} metrics={metrics} canWrite={canWrite(user.role)} />;
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      <Content />
    </Suspense>
  );
}
