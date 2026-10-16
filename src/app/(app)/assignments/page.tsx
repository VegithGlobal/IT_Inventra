import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { AssignmentsView } from "@/features/assignments/assignments-view";
import { getAssignOptions, listAssignments } from "@/features/assignments/queries";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Assignments" };

async function Content() {
  const user = await requireUser();
  const [rows, options] = await Promise.all([listAssignments(), getAssignOptions()]);
  return <AssignmentsView rows={rows} options={options} canWrite={canWrite(user.role)} />;
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
