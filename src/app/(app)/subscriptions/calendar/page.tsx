import { ChevronLeft, ChevronRight, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { listForCalendar } from "@/features/subscriptions/queries";
import { dueDatesBetween } from "@/lib/billing";
import { addDays, addMonths, monthKey, startOfMonth, today } from "@/lib/dates";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Renewal calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function parseMonth(v: string | undefined) {
  if (v && /^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  return startOfMonth(today());
}

async function Calendar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const month = parseMonth(typeof sp.month === "string" ? sp.month : undefined);
  const monthEnd = addDays(addMonths(month, 1), -1);
  const t = today();
  // Grid starts on the Monday on/before the 1st and covers whole weeks.
  const gridStart = addDays(month, -((month.getUTCDay() + 6) % 7));
  const gridEnd = addDays(monthEnd, (7 - ((monthEnd.getUTCDay() + 6) % 7) - 1) % 7);

  const subs = await listForCalendar();
  const byDay = new Map<string, { id: string; name: string; amount: number; overdue: boolean }[]>();
  let monthTotal = 0;
  let monthCount = 0;
  for (const s of subs) {
    // Overdue items stay on their original due date; projections continue from there.
    // Dates before nextDueDate are already paid, so only show from nextDueDate onwards.
    const from = s.nextDueDate > gridStart ? s.nextDueDate : gridStart;
    for (const d of dueDatesBetween(s.nextDueDate, s.billingCycle, s.customCycleDays, from, gridEnd)) {
      const key = d.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push({ id: s.id, name: s.name, amount: s.amount, overdue: d < t && d.getTime() === s.nextDueDate.getTime() });
      byDay.set(key, list);
      if (d >= month && d <= monthEnd) {
        monthTotal += s.amount;
        monthCount++;
      }
    }
  }

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const prev = monthKey(addMonths(month, -1));
  const next = monthKey(addMonths(month, 1));
  const busiest = [...byDay.entries()]
    .filter(([k]) => k.startsWith(monthKey(month)))
    .sort((a, b) => b[1].reduce((s, x) => s + x.amount, 0) - a[1].reduce((s, x) => s + x.amount, 0))[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Renewal calendar"
        description="Projected due dates for active subscriptions."
        actions={
          <Button asChild>
            <Link href="/subscriptions">
              <List />
              List view
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={`Due in ${monthFmt.format(month)}`} value={formatMoneyShort(monthTotal)} sub={`${monthCount} payment(s)`} />
        <StatCard label="Active subscriptions" value={subs.length} />
        <StatCard
          className="col-span-2 lg:col-span-1"
          label="Heaviest day"
          value={<span className="text-[20px]">{busiest ? new Date(busiest[0]).getUTCDate() + " " + monthFmt.format(month).split(" ")[0] : "—"}</span>}
          sub={busiest ? formatMoney(busiest[1].reduce((s, x) => s + x.amount, 0)) : undefined}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold text-fg">{monthFmt.format(month)}</h2>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/subscriptions/calendar?month=${monthKey(startOfMonth(t))}`}>Today</Link>
            </Button>
            <Button asChild size="icon-sm" variant="ghost" aria-label="Previous month">
              <Link href={`/subscriptions/calendar?month=${prev}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild size="icon-sm" variant="ghost" aria-label="Next month">
              <Link href={`/subscriptions/calendar?month=${next}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line bg-app text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center sm:text-left">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const items = byDay.get(key) ?? [];
            const inMonth = d.getUTCMonth() === month.getUTCMonth();
            const isToday = d.getTime() === t.getTime();
            return (
              <div key={key} className={cn("min-h-16 border-r border-b border-line p-1.5 sm:min-h-28 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-app/60")}>
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-[12.5px] tabular",
                    inMonth ? "text-fg-secondary" : "text-fg-muted/60",
                    isToday && "bg-action font-medium text-action-fg",
                  )}
                >
                  {d.getUTCDate()}
                </span>
                {/* Mobile: dots; desktop: chips */}
                <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                  {items.map((i) => (
                    <span key={i.id} className={cn("size-1.5 rounded-full", i.overdue ? "bg-danger" : "bg-brand")} aria-hidden />
                  ))}
                </div>
                <ul className="mt-1 hidden flex-col gap-1 sm:flex">
                  {items.slice(0, 3).map((i) => (
                    <li key={i.id}>
                      <Link
                        href={`/subscriptions/${i.id}`}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11.5px] leading-snug",
                          i.overdue ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-text hover:brightness-95",
                          !inMonth && "opacity-60",
                        )}
                        title={`${i.name} · ${formatMoney(i.amount)}`}
                      >
                        {i.name.split(" · ")[0]}
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && <li className="px-1.5 text-[11.5px] text-fg-muted">+{items.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function CalendarPage(props: PageProps<"/subscriptions/calendar">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-xl" />}>
      <Calendar searchParams={props.searchParams} />
    </Suspense>
  );
}
