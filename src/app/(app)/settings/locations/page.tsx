import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { listLocations } from "@/features/master-data/queries";
import { LocationsView } from "@/features/master-data/views";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Locations" };

async function Content() {
  const [user, rows] = await Promise.all([requireUser(), listLocations()]);
  return <LocationsView rows={rows} canWrite={canWrite(user.role)} isAdmin={user.role === "ADMIN"} />;
}

export default function LocationsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Content />
    </Suspense>
  );
}
