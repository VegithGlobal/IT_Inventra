import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { EmployeesView } from "@/features/employees/employees-view";
import { getLookups, listEmployees } from "@/features/employees/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Employees" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  // ?view=archived shows people who've left, until their handover is done and they're deleted.
  const view = params.view === "archived" ? "archived" : "current";
  const [rows, lookups] = await Promise.all([listEmployees(), getLookups()]);
  return <EmployeesView key={view} view={view} rows={rows} lookups={lookups} canWrite={canWrite(user.role)} canDelete={user.role === "ADMIN"} />;
}

export default function EmployeesPage(props: PageProps<"/employees">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
