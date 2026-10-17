import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/ui/page";
import { UsersView } from "@/features/settings/views";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Users & roles" };

async function Content() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return <PageHeader title="Users & roles" description="Only admins can manage logins." />;
  }
  const rows = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
  });
  return <UsersView rows={rows} meId={user.id} />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <Content />
    </Suspense>
  );
}
