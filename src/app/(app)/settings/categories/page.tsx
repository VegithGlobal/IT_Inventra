import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { CategoriesView } from "@/features/settings/views";
import { db } from "@/lib/db";
import { categorySlot } from "@/lib/options";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

async function Content() {
  const user = await requireUser();
  const [expense, ticket] = await Promise.all([
    db.expenseCategory.findMany({ include: { _count: { select: { expenses: { where: { deletedAt: null } } } } } }),
    db.ticketCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { tickets: { where: { deletedAt: null } } } } } }),
  ]);
  return (
    <CategoriesView
      isAdmin={user.role === "ADMIN"}
      expense={expense
        .sort((a, b) => categorySlot(a.colorKey) - categorySlot(b.colorKey) || a.sortOrder - b.sortOrder)
        .map((c) => ({ id: c.id, name: c.name, colorKey: c.colorKey, isSystem: c.isSystem, used: c._count.expenses }))}
      ticket={ticket.map((c) => ({ id: c.id, name: c.name, used: c._count.tickets }))}
    />
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Content />
    </Suspense>
  );
}
