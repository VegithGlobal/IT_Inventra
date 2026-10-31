import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { CategoriesView } from "@/features/settings/views";
import { db } from "@/lib/db";
import { categorySlot, VENDOR_CATEGORY } from "@/lib/options";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

async function Content() {
  const user = await requireUser();
  const [expense, ticket, vendorCustom, vendorCounts] = await Promise.all([
    db.expenseCategory.findMany({ include: { _count: { select: { expenses: { where: { deletedAt: null } } } } } }),
    db.ticketCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { tickets: { where: { deletedAt: null } } } } } }),
    db.vendorCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.vendor.groupBy({ by: ["category"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const vendorUsed = (category: string) => vendorCounts.find((c) => c.category === category)?._count._all ?? 0;
  return (
    <CategoriesView
      isAdmin={user.role === "ADMIN"}
      expense={expense
        .sort((a, b) => categorySlot(a.colorKey) - categorySlot(b.colorKey) || a.sortOrder - b.sortOrder)
        .map((c) => ({ id: c.id, name: c.name, colorKey: c.colorKey, isSystem: c.isSystem, used: c._count.expenses }))}
      ticket={ticket.map((c) => ({ id: c.id, name: c.name, used: c._count.tickets }))}
      vendor={[
        ...Object.entries(VENDOR_CATEGORY).map(([code, label]) => ({ id: code, name: label, isSystem: true, used: vendorUsed(code) })),
        ...vendorCustom.map((c) => ({ id: c.id, name: c.name, isSystem: false, used: vendorUsed(c.name) })),
      ]}
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
