import "server-only";
import { db } from "@/lib/db";
import { addMonths, HOUR_MS, istDateOf, monthKey, startOfMonth, today, utcToIstInputs } from "@/lib/dates";
import type { TicketInput } from "./schema";

export async function listTickets() {
  const now = new Date();
  const rows = await db.ticket.findMany({
    where: { deletedAt: null },
    orderBy: { seq: "desc" },
    include: {
      requester: { select: { id: true, name: true } },
      category: { select: { name: true } },
      asset: { select: { id: true, assetTag: true } },
      _count: { select: { comments: { where: { kind: "COMMENT" } } } },
    },
  });
  return rows.map((t) => {
    const done = t.status === "RESOLVED" || t.status === "CLOSED";
    return {
      id: t.id,
      seq: t.seq,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      source: t.source,
      category: t.category?.name ?? null,
      requester: t.requester.name,
      requesterId: t.requester.id,
      asset: t.asset?.assetTag ?? null,
      assetId: t.asset?.id ?? null,
      dueDate: t.dueDate,
      overdue: !done && !!t.dueDate && t.dueDate < now,
      /** Resolved/closed in the last 14 days — still shown on the board. */
      recentlyDone: done && (t.resolvedAt ?? t.updatedAt).getTime() >= now.getTime() - 14 * 86_400_000,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      timeSpentMinutes: t.timeSpentMinutes,
      comments: t._count.comments,
    };
  });
}
export type TicketRow = Awaited<ReturnType<typeof listTickets>>[number];

export async function getTicketLookups() {
  const [employees, categories, assets] = await Promise.all([
    db.employee.findMany({ where: { deletedAt: null, status: { not: "EXITED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, employeeCode: true } }),
    db.ticketCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.asset.findMany({
      where: { deletedAt: null },
      orderBy: { assetTag: "asc" },
      select: { id: true, assetTag: true, name: true, currentHolderId: true },
    }),
  ]);
  return { employees, categories, assets };
}
export type TicketLookups = Awaited<ReturnType<typeof getTicketLookups>>;

export async function getTicket(id: string) {
  const ticket = await db.ticket.findFirst({
    where: { id, deletedAt: null },
    include: {
      requester: { include: { department: true, location: true } },
      category: true,
      asset: { include: { type: true } },
      createdBy: { select: { name: true } },
      reminder: { select: { id: true, title: true } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      maintenance: { where: { deletedAt: null }, orderBy: { sentAt: "desc" } },
      stockMovements: { include: { item: { select: { id: true, name: true, unit: true } } }, orderBy: { occurredAt: "desc" } },
    },
  });
  if (!ticket) return null;
  // Other tickets from the same person / on the same asset, for context.
  const related = await db.ticket.findMany({
    where: { deletedAt: null, id: { not: id }, OR: [{ requesterId: ticket.requesterId }, ...(ticket.assetId ? [{ assetId: ticket.assetId }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
  });
  return { ticket, related };
}

type FullTicket = NonNullable<Awaited<ReturnType<typeof getTicket>>>["ticket"];

export function ticketFormValues(t: FullTicket): TicketInput {
  const due = t.dueDate ? utcToIstInputs(t.dueDate) : null;
  return {
    title: t.title,
    requesterId: t.requesterId,
    description: t.description ?? "",
    categoryId: t.categoryId ?? "",
    priority: t.priority,
    status: t.status,
    source: t.source,
    assetId: t.assetId ?? "",
    dueDate: due?.date ?? "",
    dueTime: due?.time ?? "",
    timeSpentMinutes: t.timeSpentMinutes ? String(t.timeSpentMinutes) : "",
    resolutionNotes: t.resolutionNotes ?? "",
  };
}

/** Helpdesk metrics over the last 12 months. */
export async function getTicketMetrics() {
  const t = today();
  const from = addMonths(startOfMonth(t), -11);
  const [tickets, maintenance] = await Promise.all([
    db.ticket.findMany({
      where: { deletedAt: null, createdAt: { gte: from } },
      select: {
        createdAt: true,
        resolvedAt: true,
        timeSpentMinutes: true,
        category: { select: { name: true } },
        requester: { select: { id: true, name: true } },
        asset: { select: { id: true, assetTag: true, name: true } },
      },
    }),
    db.maintenanceRecord.groupBy({ by: ["assetId"], where: { deletedAt: null, sentAt: { gte: from } }, _count: true }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({ month: monthKey(addMonths(from, i)), opened: 0, resolved: 0 }));
  const idx = new Map(months.map((m, i) => [m.month, i]));
  const resolutionHours: number[] = [];
  const byCategory = new Map<string, number>();
  const byRequester = new Map<string, { id: string; name: string; count: number }>();
  const byAsset = new Map<string, { id: string; label: string; tickets: number; repairs: number }>();

  for (const tk of tickets) {
    const o = idx.get(monthKey(istDateOf(tk.createdAt)));
    if (o !== undefined) months[o].opened++;
    if (tk.resolvedAt) {
      const r = idx.get(monthKey(istDateOf(tk.resolvedAt)));
      if (r !== undefined) months[r].resolved++;
      resolutionHours.push((tk.resolvedAt.getTime() - tk.createdAt.getTime()) / HOUR_MS);
    }
    const cat = tk.category?.name ?? "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    const req = byRequester.get(tk.requester.id) ?? { id: tk.requester.id, name: tk.requester.name, count: 0 };
    req.count++;
    byRequester.set(tk.requester.id, req);
    if (tk.asset) {
      const a = byAsset.get(tk.asset.id) ?? { id: tk.asset.id, label: `${tk.asset.assetTag} · ${tk.asset.name}`, tickets: 0, repairs: 0 };
      a.tickets++;
      byAsset.set(tk.asset.id, a);
    }
  }
  if (maintenance.length) {
    const assets = await db.asset.findMany({ where: { id: { in: maintenance.map((m) => m.assetId) } }, select: { id: true, assetTag: true, name: true } });
    for (const m of maintenance) {
      const asset = assets.find((a) => a.id === m.assetId);
      if (!asset) continue;
      const a = byAsset.get(asset.id) ?? { id: asset.id, label: `${asset.assetTag} · ${asset.name}`, tickets: 0, repairs: 0 };
      a.repairs += m._count;
      byAsset.set(asset.id, a);
    }
  }

  const sorted = [...resolutionHours].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const mean = sorted.length ? sorted.reduce((s, h) => s + h, 0) / sorted.length : null;
  return {
    months,
    total: tickets.length,
    resolvedCount: resolutionHours.length,
    avgResolutionHours: mean,
    medianResolutionHours: median,
    totalMinutes: tickets.reduce((s, tk) => s + tk.timeSpentMinutes, 0),
    topCategories: [...byCategory.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    topRequesters: [...byRequester.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    problemAssets: [...byAsset.values()]
      .map((a) => ({ ...a, score: a.tickets + a.repairs }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6),
  };
}
export type TicketMetrics = Awaited<ReturnType<typeof getTicketMetrics>>;
