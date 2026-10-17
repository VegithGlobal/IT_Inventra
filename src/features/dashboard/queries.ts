import "server-only";
import { db } from "@/lib/db";
import { addDays, addMonths, daysBetween, HOUR_MS, monthKey, startOfMonth, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { categorySlot } from "@/lib/options";

/** Headline numbers + the series behind the stat-card sparklines. */
export async function getDashboardStats() {
  const t = today();
  const now = new Date();
  const monthStart = startOfMonth(t);
  const lastMonthStart = addMonths(monthStart, -1);
  const sameDayLastMonth = addMonths(t, -1);
  const yearAgo = addMonths(monthStart, -11);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * HOUR_MS);

  const [byStatus, openTickets, overdueTickets, thisMonth, lastMonthToDate, renewals, spendRows, ticketRows] = await Promise.all([
    db.asset.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    db.ticket.count({ where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.ticket.count({ where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] }, dueDate: { lt: now } } }),
    db.expense.aggregate({ where: { deletedAt: null, date: { gte: monthStart } }, _sum: { total: true } }),
    db.expense.aggregate({ where: { deletedAt: null, date: { gte: lastMonthStart, lte: sameDayLastMonth } }, _sum: { total: true } }),
    db.subscription.findMany({ where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: addDays(t, 30) } }, select: { amount: true } }),
    db.expense.findMany({ where: { deletedAt: null, date: { gte: yearAgo } }, select: { date: true, total: true } }),
    db.ticket.findMany({ where: { deletedAt: null, createdAt: { gte: eightWeeksAgo } }, select: { createdAt: true } }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const spendByMonth = Array.from({ length: 12 }, (_, i) => monthKey(addMonths(yearAgo, i))).map((m) => ({ m, v: 0 }));
  for (const e of spendRows) {
    const row = spendByMonth.find((x) => x.m === monthKey(e.date));
    if (row) row.v += toNumber(e.total);
  }
  const ticketsByWeek = Array.from({ length: 8 }, () => 0);
  for (const tk of ticketRows) {
    const w = Math.min(7, Math.floor((tk.createdAt.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * HOUR_MS)));
    ticketsByWeek[w]++;
  }

  const month = toNumber(thisMonth._sum.total);
  const prev = toNumber(lastMonthToDate._sum.total);
  return {
    total: byStatus.reduce((s, b) => s + b._count, 0),
    assigned: count("ASSIGNED"),
    inStock: count("IN_STOCK"),
    underRepair: count("UNDER_REPAIR"),
    openTickets,
    overdueTickets,
    monthSpend: month,
    /** vs the same days of last month; null when there's nothing to compare. */
    spendChange: prev > 0 ? (month - prev) / prev : null,
    renewalsCount: renewals.length,
    renewalsAmount: renewals.reduce((s, r) => s + toNumber(r.amount), 0),
    spendSpark: spendByMonth.map((x) => x.v),
    ticketSpark: ticketsByWeek,
  };
}

export async function getUpcomingRenewals() {
  const t = today();
  const subs = await db.subscription.findMany({
    where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: addDays(t, 30) } },
    orderBy: { nextDueDate: "asc" },
    take: 7,
    include: { vendor: { select: { name: true } } },
  });
  return subs.map((s) => ({ id: s.id, name: s.name, vendor: s.vendor?.name ?? null, amount: toNumber(s.amount), currency: s.currency, due: s.nextDueDate, days: daysBetween(t, s.nextDueDate) }));
}

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export async function getMyOpenTickets(userId: string) {
  const now = new Date();
  const tickets = await db.ticket.findMany({
    where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] }, OR: [{ assigneeId: userId }, { assigneeId: null }] },
    include: { requester: { select: { name: true } } },
  });
  return tickets
    .map((t) => ({ id: t.id, number: t.ticketNumber, title: t.title, priority: t.priority, status: t.status, requester: t.requester.name, createdAt: t.createdAt, overdue: !!t.dueDate && t.dueDate < now, dueDate: t.dueDate }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 7);
}

export async function getSpendSeries() {
  const t = today();
  const from = addMonths(startOfMonth(t), -11);
  const [rows, cats] = await Promise.all([
    db.expense.findMany({ where: { deletedAt: null, date: { gte: from } }, select: { date: true, total: true, category: { select: { name: true } } } }),
    db.expenseCategory.findMany({ select: { name: true, colorKey: true } }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: monthKey(addMonths(from, i)), byCategory: {} as Record<string, number> }));
  for (const r of rows) {
    const m = months.find((x) => x.month === monthKey(r.date));
    if (m) m.byCategory[r.category.name] = (m.byCategory[r.category.name] ?? 0) + toNumber(r.total);
  }
  return { months, categories: cats.sort((a, b) => categorySlot(a.colorKey) - categorySlot(b.colorKey)) };
}

export async function getAssetBreakdown() {
  const [byStatus, byType, types] = await Promise.all([
    db.asset.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    db.asset.groupBy({ by: ["typeId"], where: { deletedAt: null }, _count: true }),
    db.assetType.findMany({ select: { id: true, name: true } }),
  ]);
  return {
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byType: byType
      .map((b) => ({ name: types.find((t) => t.id === b.typeId)?.name ?? "Other", count: b._count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getWatchlists() {
  const t = today();
  const [warranty, items, activity] = await Promise.all([
    db.asset.findMany({
      where: { deletedAt: null, status: { notIn: ["RETIRED", "DISPOSED", "LOST_STOLEN"] }, warrantyEnd: { gte: t, lte: addDays(t, 60) } },
      orderBy: { warrantyEnd: "asc" },
      take: 6,
      select: { id: true, assetTag: true, name: true, warrantyEnd: true, currentHolder: { select: { name: true } } },
    }),
    db.inventoryItem.findMany({ where: { deletedAt: null }, select: { id: true, name: true, quantity: true, minQuantity: true, unit: true } }),
    db.auditLog.findMany({
      where: { entityType: { notIn: ["Setting", "Backup"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  return {
    warranty: warranty.map((a) => ({ id: a.id, tag: a.assetTag, name: a.name, holder: a.currentHolder?.name ?? null, ends: a.warrantyEnd!, days: daysBetween(t, a.warrantyEnd!) })),
    lowStock: items
      .filter((i) => i.quantity <= i.minQuantity)
      .sort((a, b) => a.quantity / Math.max(1, a.minQuantity) - b.quantity / Math.max(1, b.minQuantity))
      .slice(0, 6),
    activity: activity.map((e) => ({ id: e.id, action: e.action, entityType: e.entityType, label: e.entityLabel ?? e.entityId, actor: e.actor?.name ?? "System", at: e.createdAt })),
  };
}

export function greetingFor(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

