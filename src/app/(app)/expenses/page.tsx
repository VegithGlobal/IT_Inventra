import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton, StatSkeleton } from "@/components/ui/page";
import { ExpensesView } from "@/features/expenses/expenses-view";
import { getExpenseCategories, getExpenseLinkOptions, listExpenses, monthlyBreakdown, resolveRange, yearOverYear } from "@/features/expenses/queries";
import { db } from "@/lib/db";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Expenses" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const range = resolveRange(await searchParams);
  const [rows, yoy, categories, vendors, linkOptions] = await Promise.all([
    listExpenses(range),
    yearOverYear(),
    getExpenseCategories(),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getExpenseLinkOptions(),
  ]);
  return (
    <ExpensesView
      rows={rows}
      months={monthlyBreakdown(rows, range)}
      yoy={yoy}
      range={range}
      categories={categories}
      vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
      linkOptions={linkOptions}
      canWrite={canWrite(user.role)}
    />
  );
}

export default function ExpensesPage(props: PageProps<"/expenses">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-14" />
          <StatSkeleton />
          <PageSkeleton />
        </div>
      }
    >
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
