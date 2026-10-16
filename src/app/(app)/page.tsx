import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader, StatCard, StatSkeleton } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { addDays, daysBetween, startOfMonth, today } from "@/lib/dates";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

// Phase 1 dashboard: live headline numbers + upcoming renewals. Phase 8 adds charts and feeds.

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

async function Greeting() {
  const user = await requireUser();
  return (
    <PageHeader
      title={`${greeting()}, ${user.name.split(" ")[0]}`}
      description={formatDate(today())}
      actions={
        <>
          <Button asChild size="sm">
            <Link href="/expenses?new=1">+ Expense</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/assignments?assign=1">Assign asset</Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href="/assets?new=1">+ Asset</Link>
          </Button>
        </>
      }
    />
  );
}

async function Stats() {
  await connection(); // reads the clock — must render per request
  const t = today();
  const [total, assigned, inStock, repair, openTickets, spend, renewals] = await Promise.all([
    db.asset.count({ where: { deletedAt: null } }),
    db.asset.count({ where: { deletedAt: null, status: "ASSIGNED" } }),
    db.asset.count({ where: { deletedAt: null, status: "IN_STOCK" } }),
    db.asset.count({ where: { deletedAt: null, status: "UNDER_REPAIR" } }),
    db.ticket.count({ where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.expense.aggregate({ _sum: { total: true }, where: { deletedAt: null, date: { gte: startOfMonth(t) } } }),
    db.subscription.count({ where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: addDays(t, 30) } } }),
  ]);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total assets" value={formatNumber(total)} sub={`${repair} under repair`} />
      <StatCard label="Assigned" value={formatNumber(assigned)} />
      <StatCard label="In stock" value={formatNumber(inStock)} />
      <StatCard label="Open tickets" value={formatNumber(openTickets)} />
      <StatCard label="This month's spend" value={formatMoneyShort(spend._sum.total)} />
      <StatCard label="Renewals in 30 days" value={formatNumber(renewals)} />
    </div>
  );
}

async function Renewals() {
  await connection();
  const t = today();
  const subs = await db.subscription.findMany({
    where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: addDays(t, 30) } },
    orderBy: { nextDueDate: "asc" },
    take: 8,
    include: { vendor: { select: { name: true } } },
  });
  return (
    <Card>
      <CardHeader
        title="Upcoming payments & renewals"
        description="Next 30 days"
        action={
          <Link href="/subscriptions" className="text-[13px] font-medium text-fg-secondary hover:text-fg">
            View all
          </Link>
        }
      />
      <ul className="pb-2">
        {subs.length === 0 && <li className="px-5 py-6 text-[13.5px] text-fg-muted">Nothing due in the next 30 days.</li>}
        {subs.map((s) => {
          const days = daysBetween(t, s.nextDueDate);
          return (
            <li key={s.id} className="relative">
              {days >= 0 && days <= 7 && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />}
              <Link href={`/subscriptions/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-subtle">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-fg">{s.name}</p>
                  <p className="truncate text-[12.5px] text-fg-muted">{s.vendor?.name ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13.5px] text-fg tabular">{formatMoney(s.amount)}</p>
                  <p className={cn("text-[12.5px]", days < 0 ? "text-danger" : "text-fg-muted")}>
                    {days < 0 ? <Badge tone="danger">Overdue</Badge> : days === 0 ? "Due today" : `Due ${formatDate(s.nextDueDate)}`}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-14" />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<StatSkeleton count={6} />}>
        <Stats />
      </Suspense>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<Card className="h-80" />}>
            <Renewals />
          </Suspense>
        </div>
        <Card className="flex flex-col justify-center p-6 text-[13.5px] text-fg-muted">
          Charts, open tickets and the activity feed arrive with the Phase 8 dashboard.
        </Card>
      </div>
    </div>
  );
}
