import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { listDepartments } from "@/features/master-data/queries";
import { DepartmentsView } from "@/features/master-data/views";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Departments" };

async function Content() {
  const [user, rows] = await Promise.all([requireUser(), listDepartments()]);
  return <DepartmentsView rows={rows} canWrite={canWrite(user.role)} isAdmin={user.role === "ADMIN"} />;
}

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Content />
    </Suspense>
  );
}
