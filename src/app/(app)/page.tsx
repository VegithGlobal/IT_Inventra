import { ArrowDownRight, ArrowUpRight, CalendarClock, PackageMinus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PriorityDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaversCallout } from "@/features/accounts/accounts-view";
import { listOpenLeavers } from "@/features/accounts/queries";
import { Donut, Sparkline } from "@/features/dashboard/charts";
import { getAssetBreakdown, getDashboardStats, getMyOpenTickets, getSpendSeries, getUpcomingRenewals, getWatchlists, greetingFor } from "@/features/dashboard/queries";
import { SpendByMonthChart } from "@/features/expenses/charts";
import { relativeTime } from "@/features/notifications/meta";
import { NewTicketButton } from "@/features/tickets/quick-add";
import { today } from "@/lib/dates";
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from "@/lib/format";
import { ASSET_STATUS, TICKET_STATUS, formatAge } from "@/lib/options";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

// Status → categorical slot, in the validated palette order (Assigned leads in lime).
const STATUS_SLICES = [
  ["ASSIGNED", "var(--chart-1)"],
  ["IN_STOCK", "var(--chart-2)"],
  ["UNDER_REPAIR", "var(--chart-3)"],
  ["IN_TRANSIT", "var(--chart-4)"],
  ["LOST_STOLEN", "var(--chart-5)"],
  ["RETIRED", "var(--chart-6)"],
  ["DISPOSED", "var(--chart-7)"],
] as const;

const VERB: Record<string, string> = { CREATE: "created", UPDATE: "updated", DELETE: "archived", RESTORE: "restored", REVEAL: "viewed the password of" };

function Stat({ label, value, sub, trend, spark, href }: { label: string; value: ReactNode; sub?: ReactNode; trend?: ReactNode; spark?: number[]; href: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-subtle/60">
      <p className="text-[13px] text-fg-muted">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[22px] leading-none font-semibold tracking-[-0.01em] text-fg tabular sm:text-[28px]">{value}</span>
        {trend}
      </div>
      {sub && <p className="mt-2 text-[12.5px] text-fg-muted">{sub}</p>}
      {spark && <Sparkline values={spark} className="mt-3 h-7 w-full" />}
    </Link>
  );
}

async function Greeting() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-fg">
          {greetingFor(new Date())}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[14px] text-fg-secondary">{formatDate(today())}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href="/invoices?new=1">Upload invoice</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/assignments?assign=1">Assign asset</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/expenses?new=1">+ Expense</Link>
        </Button>
        <NewTicketButton />
        <Button asChild size="sm" variant="primary">
          <Link href="/assets?new=1">+ Asset</Link>
        </Button>
      </div>
    </div>
  );
}

/** Only shows up when someone who is leaving or has left still has active logins. */
async function LeaverAccess() {
  await connection();
  const leavers = await listOpenLeavers();
  return <LeaversCallout leavers={leavers} />;
}

async function Stats() {
  await connection();
  const s = await getDashboardStats();
  const change = s.spendChange;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Total assets" value={formatNumber(s.total)} sub={`${s.underRepair} under repair`} href="/assets" />
      <Stat label="Assigned" value={formatNumber(s.assigned)} sub={s.total ? `${Math.round((s.assigned / s.total) * 100)}% of assets` : undefined} href="/assignments" />
      <Stat label="In stock" value={formatNumber(s.inStock)} sub="Ready to assign" href="/assets" />
      <Stat
        label="Open tickets"
        value={formatNumber(s.openTickets)}
        sub={s.overdueTickets ? <span className="text-danger">{s.overdueTickets} overdue</span> : "None overdue"}
        spark={s.ticketSpark}
        href="/tickets"
      />
      <Stat
        label="This month's spend"
        value={formatMoneyShort(s.monthSpend)}
        trend={
          change === null ? null : (
            <Badge tone={change > 0.05 ? "warning" : change < -0.05 ? "success" : "neutral"} className="gap-0.5">
              {change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(Math.round(change * 100))}%
            </Badge>
          )
        }
        sub="vs same days last month"
        spark={s.spendSpark}
        href="/expenses?range=this-month"
      />
      <Stat label="Renewals in 30 days" value={formatNumber(s.renewalsCount)} sub={formatMoney(s.renewalsAmount)} href="/subscriptions" />
    </div>
  );
}

async function Renewals() {
  await connection();
  const rows = await getUpcomingRenewals();
  return (
    <Card className="h-full">
      <CardHeader title="Upcoming payments & renewals" description="Next 30 days" action={<Link href="/subscriptions/calendar" className="text-[13px] font-medium text-fg-secondary hover:text-fg">Calendar</Link>} />
      <ul className="pb-2">
        {rows.length === 0 && <li className="px-5 py-8 text-center text-[13.5px] text-fg-muted">Nothing due in the next 30 days.</li>}
        {rows.map((s) => (
          <li key={s.id} className="relative">
            {s.days >= 0 && s.days <= 7 && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />}
            <Link href={`/subscriptions/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-subtle">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle">
                <CalendarClock className="size-4 text-fg-muted" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-fg">{s.name}</span>
                <span className="block truncate text-[12.5px] text-fg-muted">{s.vendor ?? "—"}</span>
              </span>
              <span className="text-right">
                <span className="block text-[13.5px] text-fg tabular">{formatMoney(s.amount, s.currency)}</span>
                <span className="block text-[12.5px]">
                  {s.days < 0 ? <Badge tone="danger">Overdue</Badge> : <span className={cn(s.days <= 7 ? "font-medium text-brand-text" : "text-fg-muted")}>{s.days === 0 ? "Due today" : `Due ${formatDate(s.due)}`}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function MyTickets() {
  const user = await requireUser();
  const rows = await getMyOpenTickets(user.id);
  return (
    <Card className="h-full">
      <CardHeader title="My open tickets" action={<Link href="/tickets?view=today" className="text-[13px] font-medium text-fg-secondary hover:text-fg">My Today</Link>} />
      <ul className="pb-2">
        {rows.length === 0 && <li className="px-5 py-8 text-center text-[13.5px] text-fg-muted">No open tickets. Press N to log one.</li>}
        {rows.map((t) => (
          <li key={t.id}>
            <Link href={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
              <PriorityDot priority={t.priority} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-fg">{t.title}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                  <span className="font-mono">{t.number}</span> · <Avatar name={t.requester} size="xs" className="size-4 text-[8px]" /> {t.requester}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                <span className={cn("text-[11.5px]", t.overdue ? "font-medium text-danger" : "text-fg-muted")}>{t.overdue ? "Overdue" : formatAge(t.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function SpendChart() {
  await connection();
  const { months, categories } = await getSpendSeries();
  const any = months.some((m) => Object.keys(m.byCategory).length);
  return (
    <Card className="h-full">
      <CardHeader title="Monthly IT spend" description="Last 12 months, by category" action={<Link href="/expenses" className="text-[13px] font-medium text-fg-secondary hover:text-fg">Expenses</Link>} />
      <CardBody>{any ? <SpendByMonthChart data={months} categories={categories} /> : <p className="py-16 text-center text-[13.5px] text-fg-muted">No expenses recorded yet.</p>}</CardBody>
    </Card>
  );
}

async function AssetCharts() {
  await connection();
  const { byStatus, byType } = await getAssetBreakdown();
  const total = byStatus.reduce((s, x) => s + x.count, 0);
  const maxType = Math.max(1, ...byType.map((t) => t.count));
  return (
    <Card className="h-full">
      <CardHeader title="Assets" description="By status and type" />
      <CardBody className="flex flex-col gap-6">
        <Donut
          centerLabel="assets"
          centerValue={String(total)}
          slices={STATUS_SLICES.map(([key, color]) => ({ key, label: ASSET_STATUS[key].label, value: byStatus.find((s) => s.status === key)?.count ?? 0, color }))}
        />
        <ul className="flex flex-col gap-2 border-t border-line pt-4">
          {byType.slice(0, 6).map((t) => (
            <li key={t.name} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-[12.5px]">
              <span className="truncate text-fg-secondary">{t.name}</span>
              <span className="h-2 rounded-full bg-subtle">
                <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(t.count / maxType) * 100}%` }} />
              </span>
              <span className="text-right text-fg tabular">{t.count}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

async function Watchlists() {
  await connection();
  const { warranty, lowStock, activity } = await getWatchlists();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="min-w-0">
        <CardHeader title="Warranty expiring soon" description="Next 60 days" />
        <ul className="pb-2">
          {warranty.length === 0 && <li className="px-5 py-6 text-[13px] text-fg-muted">No warranties ending soon.</li>}
          {warranty.map((a) => (
            <li key={a.id}>
              <Link href={`/assets/${a.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                <ShieldCheck className="size-4 shrink-0 text-fg-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-fg">
                    <span className="font-mono text-[12.5px]">{a.tag}</span> {a.name}
                  </span>
                  <span className="block truncate text-[12px] text-fg-muted">{a.holder ?? "Unassigned"}</span>
                </span>
                <span className={cn("text-[12.5px] tabular", a.days <= 14 ? "font-medium text-warning" : "text-fg-muted")}>{a.days}d</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Low stock" action={<Link href="/inventory" className="text-[13px] font-medium text-fg-secondary hover:text-fg">Inventory</Link>} />
        <ul className="pb-2">
          {lowStock.length === 0 && <li className="px-5 py-6 text-[13px] text-fg-muted">Everything is above its reorder point.</li>}
          {lowStock.map((i) => (
            <li key={i.id}>
              <Link href={`/inventory/${i.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                <PackageMinus className="size-4 shrink-0 text-fg-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{i.name}</span>
                <Badge tone={i.quantity === 0 ? "danger" : "warning"}>
                  {i.quantity} / {i.minQuantity} {i.unit}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Recent activity" action={<Link href="/audit-log" className="text-[13px] font-medium text-fg-secondary hover:text-fg">Audit log</Link>} />
        <ul className="pb-2">
          {activity.length === 0 && <li className="px-5 py-6 text-[13px] text-fg-muted">No changes yet.</li>}
          {activity.map((e) => (
            <li key={e.id} className="flex gap-3 px-5 py-2.5">
              <Avatar name={e.actor} size="xs" className="mt-0.5" />
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="text-fg">{e.actor}</span> <span className="text-fg-muted">{VERB[e.action] ?? e.action.toLowerCase()}</span>{" "}
                <span className="line-clamp-1 text-fg-secondary">{e.label}</span>
              </span>
              <span className="shrink-0 text-[11.5px] text-fg-muted">{relativeTime(e.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const box = (h: string) => <Skeleton className={cn("w-full rounded-xl", h)} />;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-14" />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <LeaverAccess />
      </Suspense>
      <Suspense fallback={box("h-36")}>
        <Stats />
      </Suspense>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <Suspense fallback={box("h-96")}>
            <Renewals />
          </Suspense>
        </div>
        <div className="min-w-0 xl:col-span-2">
          <Suspense fallback={box("h-96")}>
            <MyTickets />
          </Suspense>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Suspense fallback={box("h-[420px]")}>
            <SpendChart />
          </Suspense>
        </div>
        <Suspense fallback={box("h-[420px]")}>
          <AssetCharts />
        </Suspense>
      </div>
      <Suspense fallback={box("h-72")}>
        <Watchlists />
      </Suspense>
    </div>
  );
}
