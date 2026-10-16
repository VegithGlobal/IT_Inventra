import "server-only";
import { addDays, daysBetween, HOUR_MS, istDateOf, utcToIstInputs } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import type { ReminderInput, TicketTemplate } from "./schema";

export async function listReminders() {
  const rows = await db.reminder.findMany({
    where: { deletedAt: null },
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    include: { asset: { select: { id: true, assetTag: true } }, subscription: { select: { id: true, name: true } } },
  });
  return rows.map((r) => {
    const { date, time } = utcToIstInputs(r.nextRunAt);
    const tpl = (r.template ?? null) as Partial<TicketTemplate> | null;
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      nextRunAt: r.nextRunAt,
      lastTriggeredAt: r.lastTriggeredAt,
      repeatRule: r.repeatRule,
      repeatEveryDays: r.repeatEveryDays,
      active: r.active,
      notes: r.notes,
      link: r.asset ? { label: r.asset.assetTag, href: `/assets/${r.asset.id}` } : r.subscription ? { label: r.subscription.name, href: `/subscriptions/${r.subscription.id}` } : null,
      form: {
        title: r.title,
        type: r.type,
        date,
        time,
        repeatRule: r.repeatRule,
        repeatEveryDays: r.repeatEveryDays ? String(r.repeatEveryDays) : "",
        notes: r.notes ?? "",
        assetId: r.assetId ?? "",
        subscriptionId: r.subscriptionId ?? "",
        active: r.active,
        ticketRequesterId: tpl?.requesterId ?? "",
        ticketCategoryId: tpl?.categoryId ?? "",
        ticketPriority: tpl?.priority ?? "MEDIUM",
      } satisfies ReminderInput,
    };
  });
}
export type ReminderRow = Awaited<ReturnType<typeof listReminders>>[number];

export type UpcomingItem = { key: string; date: Date; kind: string; title: string; detail: string; href: string; overdue: boolean };

/** Everything the engine will remind about in the next `days` days (plus anything already overdue). */
export async function getUpcoming(days = 30): Promise<UpcomingItem[]> {
  const now = new Date();
  const today = istDateOf(now);
  const until = addDays(today, days);
  const [subs, assets, licenses, returns, tickets, reminders] = await Promise.all([
    db.subscription.findMany({ where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: until } }, include: { vendor: { select: { name: true } } } }),
    db.asset.findMany({ where: { deletedAt: null, status: { notIn: ["RETIRED", "DISPOSED", "LOST_STOLEN"] }, warrantyEnd: { gte: today, lte: until } } }),
    db.license.findMany({ where: { deletedAt: null, expiryDate: { not: null, lte: until } } }),
    db.assetAssignment.findMany({
      where: { returnedAt: null, expectedReturnAt: { not: null, lte: until }, asset: { deletedAt: null } },
      include: { asset: { select: { id: true, assetTag: true } }, employee: { select: { name: true } } },
    }),
    db.ticket.findMany({ where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] }, dueDate: { not: null, lte: new Date(until.getTime() + 24 * HOUR_MS) } } }),
    db.reminder.findMany({ where: { deletedAt: null, active: true, nextRunAt: { lte: new Date(until.getTime() + 24 * HOUR_MS) } } }),
  ]);
  const items: UpcomingItem[] = [
    ...subs.map((x) => ({
      key: `s${x.id}`,
      date: x.nextDueDate,
      kind: "Payment",
      title: x.name,
      detail: `${formatMoney(x.amount, x.currency)}${x.vendor ? ` · ${x.vendor.name}` : ""}`,
      href: `/subscriptions/${x.id}`,
      overdue: x.nextDueDate < today,
    })),
    ...assets.map((x) => ({ key: `w${x.id}`, date: x.warrantyEnd!, kind: "Warranty", title: `${x.assetTag} warranty ends`, detail: x.name, href: `/assets/${x.id}`, overdue: false })),
    ...licenses.map((x) => ({ key: `l${x.id}`, date: x.expiryDate!, kind: "License", title: `${x.name} expires`, detail: `${x.totalSeats} seat(s)`, href: "/licenses", overdue: x.expiryDate! < today })),
    ...returns.map((x) => ({
      key: `r${x.id}`,
      date: x.expectedReturnAt!,
      kind: "Return",
      title: `${x.asset.assetTag} due back`,
      detail: `From ${x.employee.name}`,
      href: `/assets/${x.asset.id}`,
      overdue: x.expectedReturnAt! < today,
    })),
    ...tickets.map((x) => ({ key: `t${x.id}`, date: istDateOf(x.dueDate!), kind: "Ticket", title: `${x.ticketNumber} due`, detail: x.title, href: `/tickets/${x.id}`, overdue: x.dueDate! < now })),
    ...reminders.map((x) => ({ key: `c${x.id}`, date: istDateOf(x.nextRunAt), kind: "Reminder", title: x.title, detail: x.notes ?? "", href: "/reminders", overdue: x.nextRunAt < now })),
  ];
  return items.sort((a, b) => a.date.getTime() - b.date.getTime() || a.kind.localeCompare(b.kind)).map((i) => ({ ...i, overdue: i.overdue || daysBetween(today, i.date) < 0 }));
}

export async function getReminderLinkOptions() {
  const [assets, subscriptions, employees, categories] = await Promise.all([
    db.asset.findMany({ where: { deletedAt: null }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, name: true } }),
    db.subscription.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ where: { deletedAt: null, status: { not: "EXITED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.ticketCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    employees: employees.map((e) => ({ value: e.id, label: e.name })),
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
    assets: assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` })),
    subscriptions: subscriptions.map((s) => ({ value: s.id, label: s.name })),
  };
}
export type ReminderLinkOptions = Awaited<ReturnType<typeof getReminderLinkOptions>>;

export async function getNotificationStats() {
  const since = new Date(Date.now() - 24 * HOUR_MS);
  const [lastDay, emailedLastDay] = await Promise.all([
    db.notification.findMany({ where: { createdAt: { gte: since } }, distinct: ["type", "title"], select: { id: true } }),
    db.notification.count({ where: { emailedAt: { gte: since } } }),
  ]);
  return { lastDay: lastDay.length, emailedLastDay };
}
