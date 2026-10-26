import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { EmployeesView } from "@/features/employees/employees-view";
import { getLookups, listEmployees } from "@/features/employees/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Employees" };

async function Content() {
  const user = await requireUser();
  const [rows, lookups] = await Promise.all([listEmployees(), getLookups()]);
  return <EmployeesView rows={rows} lookups={lookups} canWrite={canWrite(user.role)} canDelete={user.role === "ADMIN"} />;
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
