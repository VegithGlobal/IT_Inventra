import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { AuditView } from "@/features/audit/audit-view";
import { AUDIT_LIMIT, listAudit, resolveAuditFilters } from "@/features/audit/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Audit log" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const filters = resolveAuditFilters(await searchParams);
  const { rows, entityTypes, actors } = await listAudit(filters);
  return <AuditView rows={rows} filters={filters} entityTypes={entityTypes} actors={actors} limit={AUDIT_LIMIT} />;
}

export default function AuditLogPage(props: PageProps<"/audit-log">) {
  return (
    <Suspense fallback={<PageSkeleton rows={12} />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
