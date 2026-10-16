import "server-only";
import { db } from "@/lib/db";
import { addDays, addMonths, monthKey, parseDateInput, startOfMonth, toDateInput, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { categorySlot } from "@/lib/options";
import type { ExpenseInput } from "./schema";

// ─── Date ranges (Indian financial year: 1 Apr – 31 Mar) ──────────────────────

export const RANGE_PRESETS = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-fy", label: "This FY" },
  { key: "last-fy", label: "Last FY" },
  { key: "last-12", label: "Last 12 months" },
  { key: "all", label: "All time" },
] as const;
export type RangeKey = (typeof RANGE_PRESETS)[number]["key"] | "custom";

export function fyStart(d: Date) {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 3, 1));
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function resolveRange(sp: Record<string, string | string[] | undefined>) {
  const t = today();
  const range = (typeof sp.range === "string" ? sp.range : "") as RangeKey;
  if (isDate(sp.from) && isDate(sp.to)) {
    const from = parseDateInput(sp.from);
    const to = parseDateInput(sp.to);
    return { key: "custom" as RangeKey, from: from <= to ? from : to, to: from <= to ? to : from };
  }
  switch (range) {
    case "this-month":
      return { key: range, from: startOfMonth(t), to: t };
    case "last-month":
      return { key: range, from: addMonths(startOfMonth(t), -1), to: addDays(startOfMonth(t), -1) };
    case "this-fy":
      return { key: range, from: fyStart(t), to: t };
    case "last-fy":
      return { key: range, from: addMonths(fyStart(t), -12), to: addDays(fyStart(t), -1) };
    case "all":
      return { key: range, from: new Date(Date.UTC(2000, 0, 1)), to: t };
    default:
      return { key: "last-12" as RangeKey, from: addMonths(startOfMonth(t), -11), to: t };
  }
}
export type ResolvedRange = ReturnType<typeof resolveRange>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getExpenseCategories() {
  const cats = await db.expenseCategory.findMany({ orderBy: { sortOrder: "asc" } });
  return cats
    .map((c) => ({ id: c.id, name: c.name, colorKey: c.colorKey, isSystem: c.isSystem }))
    .sort((a, b) => categorySlot(a.colorKey) - categorySlot(b.colorKey));
}
export type ExpenseCategoryRow = Awaited<ReturnType<typeof getExpenseCategories>>[number];

export async function listExpenses(range: { from: Date; to: Date }) {
  const rows = await db.expense.findMany({
    where: { deletedAt: null, date: { gte: range.from, lte: range.to } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      category: true,
      vendor: { select: { id: true, name: true } },
      asset: { select: { id: true, assetTag: true } },
      subscription: { select: { id: true, name: true } },
      ticket: { select: { id: true, ticketNumber: true } },
      inventoryItem: { select: { id: true, name: true } },
      subscriptionPayment: { select: { id: true } },
      _count: { select: { documents: { where: { deletedAt: null } } } },
    },
  });
  return rows.map((e) => {
    const link = e.asset
      ? { label: e.asset.assetTag, href: `/assets/${e.asset.id}` }
      : e.subscription
        ? { label: e.subscription.name, href: `/subscriptions/${e.subscription.id}` }
        : e.ticket
          ? { label: e.ticket.ticketNumber, href: `/tickets/${e.ticket.id}` }
          : e.inventoryItem
            ? { label: e.inventoryItem.name, href: `/inventory/${e.inventoryItem.id}` }
            : null;
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      category: e.category.name,
      categoryKey: e.category.colorKey,
      vendor: e.vendor?.name ?? null,
      amount: toNumber(e.amount),
      taxAmount: toNumber(e.taxAmount),
      total: toNumber(e.total),
      paymentMode: e.paymentMode,
      transactionRef: e.transactionRef,
      paidBy: e.paidBy,
      notes: e.notes,
      source: e.source,
      link,
      fromPayment: !!e.subscriptionPayment,
      documents: e._count.documents,
      form: {
        date: toDateInput(e.date),
        categoryId: e.categoryId,
        description: e.description,
        amount: e.total.toString(),
        taxAmount: e.taxAmount.isZero() ? "" : e.taxAmount.toString(),
        vendorId: e.vendorId ?? "",
        paymentMode: e.paymentMode ?? "",
        transactionRef: e.transactionRef ?? "",
        paidBy: e.paidBy ?? "",
        notes: e.notes ?? "",
        linkType: e.assetId ? "asset" : e.subscriptionId ? "subscription" : e.ticketId ? "ticket" : e.inventoryItemId ? "inventoryItem" : "",
        linkId: e.assetId ?? e.subscriptionId ?? e.ticketId ?? e.inventoryItemId ?? "",
      } satisfies ExpenseInput,
    };
  });
}
export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

/** Month buckets × category for the stacked chart and the summary table. */
export function monthlyBreakdown(rows: ExpenseRow[], range: { from: Date; to: Date }) {
  const first = rows.length ? rows.reduce((m, r) => (r.date < m ? r.date : m), range.to) : range.from;
  const start = startOfMonth(range.from > first ? range.from : first);
  const months: string[] = [];
  for (let d = start; d <= range.to && months.length < 120; d = addMonths(d, 1)) months.push(monthKey(d));
  const buckets = new Map(months.map((m) => [m, { month: m, total: 0, tax: 0, count: 0, byCategory: {} as Record<string, number> }]));
  for (const r of rows) {
    const b = buckets.get(monthKey(r.date));
    if (!b) continue;
    b.total += r.total;
    b.tax += r.taxAmount;
    b.count++;
    b.byCategory[r.category] = (b.byCategory[r.category] ?? 0) + r.total;
  }
  return [...buckets.values()];
}

/** This FY vs last FY, by FY month (Apr → Mar). Independent of the page's range filter. */
export async function yearOverYear() {
  const t = today();
  const thisFy = fyStart(t);
  const lastFy = addMonths(thisFy, -12);
  const rows = await db.expense.findMany({
    where: { deletedAt: null, date: { gte: lastFy, lte: t } },
    select: { date: true, total: true },
  });
  const series = Array.from({ length: 12 }, (_, i) => ({ month: monthKey(addMonths(thisFy, i)), current: null as number | null, previous: 0 }));
  for (const r of rows) {
    const inThis = r.date >= thisFy;
    const base = inThis ? thisFy : lastFy;
    const idx = (r.date.getUTCFullYear() - base.getUTCFullYear()) * 12 + (r.date.getUTCMonth() - base.getUTCMonth());
    if (idx < 0 || idx > 11) continue;
    if (inThis) series[idx].current = (series[idx].current ?? 0) + toNumber(r.total);
    else series[idx].previous += toNumber(r.total);
  }
  // Months of this FY that have started get 0 instead of null, so the line reaches today.
  const elapsed = (t.getUTCFullYear() - thisFy.getUTCFullYear()) * 12 + (t.getUTCMonth() - thisFy.getUTCMonth());
  for (let i = 0; i <= elapsed && i < 12; i++) series[i].current ??= 0;
  const ytdNow = series.reduce((s, x) => s + (x.current ?? 0), 0);
  const ytdPrev = series.slice(0, elapsed + 1).reduce((s, x) => s + x.previous, 0);
  return { series, thisFyLabel: fyLabel(thisFy), lastFyLabel: fyLabel(lastFy), ytdNow, ytdPrev };
}

const fyLabel = (start: Date) => `FY ${String(start.getUTCFullYear()).slice(2)}–${String(start.getUTCFullYear() + 1).slice(2)}`;

/** Options for the expense form's "linked to" picker. */
export async function getExpenseLinkOptions() {
  const [assets, subscriptions, tickets, items] = await Promise.all([
    db.asset.findMany({ where: { deletedAt: null }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, name: true } }),
    db.subscription.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.ticket.findMany({ where: { deletedAt: null }, orderBy: { seq: "desc" }, take: 200, select: { id: true, ticketNumber: true, title: true } }),
    db.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
  ]);
  return {
    asset: assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` })),
    subscription: subscriptions.map((s) => ({ value: s.id, label: s.name })),
    ticket: tickets.map((t) => ({ value: t.id, label: `${t.ticketNumber} · ${t.title}` })),
    inventoryItem: items.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` })),
  };
}
export type ExpenseLinkOptions = Awaited<ReturnType<typeof getExpenseLinkOptions>>;
