import "server-only";
import { db } from "@/lib/db";
import { daysBetween, toDateInput, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { fyStart } from "@/features/expenses/queries";
import type { MaintenanceInput } from "./schema";

export async function listMaintenance() {
  const t = today();
  const rows = await db.maintenanceRecord.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { sentAt: "desc" }],
    include: {
      asset: { select: { id: true, assetTag: true, name: true, status: true } },
      vendor: { select: { id: true, name: true } },
      ticket: { select: { id: true, ticketNumber: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    assetId: m.asset.id,
    assetTag: m.asset.assetTag,
    assetName: m.asset.name,
    issue: m.issue,
    vendor: m.vendor?.name ?? null,
    sentAt: m.sentAt,
    expectedReturnAt: m.expectedReturnAt,
    returnedAt: m.returnedAt,
    status: m.status,
    overdue: m.status === "OPEN" && !!m.expectedReturnAt && m.expectedReturnAt < t,
    daysOut: daysBetween(m.sentAt, m.returnedAt ?? t),
    cost: m.cost === null ? null : toNumber(m.cost),
    underWarranty: m.underWarranty,
    previousAssetStatus: m.previousAssetStatus,
    outcome: m.outcome,
    ticket: m.ticket,
    form: {
      assetId: m.assetId,
      issue: m.issue,
      sentAt: toDateInput(m.sentAt),
      vendorId: m.vendorId ?? "",
      expectedReturnAt: toDateInput(m.expectedReturnAt),
      underWarranty: m.underWarranty,
      cost: m.cost?.toString() ?? "",
      ticketId: m.ticketId ?? "",
      notes: m.notes ?? "",
    } satisfies MaintenanceInput,
  }));
}
export type MaintenanceRow = Awaited<ReturnType<typeof listMaintenance>>[number];

export async function getMaintenanceLookups() {
  const [assets, vendors, tickets] = await Promise.all([
    db.asset.findMany({ where: { deletedAt: null, status: { not: "DISPOSED" } }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, name: true, warrantyEnd: true } }),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true } }),
    db.ticket.findMany({ where: { deletedAt: null, status: { notIn: ["CLOSED"] } }, orderBy: { seq: "desc" }, take: 200, select: { id: true, ticketNumber: true, title: true, assetId: true } }),
  ]);
  const t = today();
  return {
    assets: assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}`, inWarranty: !!a.warrantyEnd && a.warrantyEnd >= t })),
    // Service centres first — they're who repairs go to.
    vendors: [...vendors.filter((v) => v.category === "SERVICE_CENTER"), ...vendors.filter((v) => v.category !== "SERVICE_CENTER")].map((v) => ({
      value: v.id,
      label: v.category === "SERVICE_CENTER" ? `${v.name} (service centre)` : v.name,
    })),
    tickets: tickets.map((tk) => ({ value: tk.id, label: `${tk.ticketNumber} · ${tk.title}`, assetId: tk.assetId })),
  };
}
export type MaintenanceLookups = Awaited<ReturnType<typeof getMaintenanceLookups>>;

export async function getMaintenanceStats() {
  const from = fyStart(today());
  const spend = await db.expense.aggregate({ where: { deletedAt: null, source: "MAINTENANCE", date: { gte: from } }, _sum: { total: true } });
  return { fySpend: toNumber(spend._sum.total) };
}

export async function listPreventiveSchedules() {
  const rows = await db.reminder.findMany({
    where: { deletedAt: null, type: "PREVENTIVE_MAINTENANCE" },
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    include: { asset: { select: { id: true, assetTag: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    nextRunAt: r.nextRunAt,
    repeatRule: r.repeatRule,
    repeatEveryDays: r.repeatEveryDays,
    active: r.active,
    asset: r.asset,
  }));
}
export type PreventiveRow = Awaited<ReturnType<typeof listPreventiveSchedules>>[number];
