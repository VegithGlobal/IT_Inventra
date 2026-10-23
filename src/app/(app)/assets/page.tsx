import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { AssetsView } from "@/features/assets/assets-view";
import { listAssets } from "@/features/assets/queries";
import { getLookups } from "@/features/employees/queries";
import { ASSET_STATUS } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Assets" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  // ?status=ASSIGNED etc. (dashboard cards link here) pre-selects the status filter.
  const status = typeof params.status === "string" && params.status in ASSET_STATUS ? params.status : "";
  const [rows, lookups] = await Promise.all([listAssets(), getLookups()]);
  return <AssetsView key={status} initialStatus={status} rows={rows} lookups={lookups} canWrite={canWrite(user.role)} canDelete={user.role === "ADMIN"} />;
}

export default function AssetsPage(props: PageProps<"/assets">) {
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
