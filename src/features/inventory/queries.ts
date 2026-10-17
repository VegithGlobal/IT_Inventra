import "server-only";
import { db } from "@/lib/db";
import { startOfMonth, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { ItemInput } from "./schema";

export async function listItems() {
  const items = await db.inventoryItem.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      location: { select: { name: true } },
      vendor: { select: { name: true } },
      movements: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true, type: true } },
    },
  });
  return items.map((i) => {
    const unitCost = i.unitCost === null ? null : toNumber(i.unitCost);
    return {
      id: i.id,
      name: i.name,
      category: i.category,
      sku: i.sku,
      unit: i.unit,
      quantity: i.quantity,
      minQuantity: i.minQuantity,
      low: i.quantity <= i.minQuantity,
      unitCost,
      stockValue: unitCost === null ? null : unitCost * i.quantity,
      location: i.location?.name ?? null,
      vendor: i.vendor?.name ?? null,
      lastMovementAt: i.movements[0]?.occurredAt ?? null,
    };
  });
}
export type ItemRow = Awaited<ReturnType<typeof listItems>>[number];

export async function getInventoryStats() {
  const since = startOfMonth(today());
  const [out, inn] = await Promise.all([
    db.stockMovement.aggregate({ where: { type: "STOCK_OUT", occurredAt: { gte: since }, item: { deletedAt: null } }, _sum: { quantityChange: true }, _count: true }),
    db.expense.aggregate({ where: { deletedAt: null, source: "STOCK_IN", date: { gte: since } }, _sum: { total: true } }),
  ]);
  return { issuedThisMonth: -(out._sum.quantityChange ?? 0), issueCount: out._count, purchasedThisMonth: toNumber(inn._sum.total) };
}

export async function getItem(id: string) {
  const item = await db.inventoryItem.findFirst({
    where: { id, deletedAt: null },
    include: {
      location: true,
      vendor: true,
      movements: {
        orderBy: { occurredAt: "desc" },
        take: 200,
        include: {
          employee: { select: { id: true, name: true } },
          ticket: { select: { id: true, ticketNumber: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });
  if (!item) return null;
  const [spend, issued] = await Promise.all([
    db.expense.aggregate({ where: { inventoryItemId: id, deletedAt: null }, _sum: { total: true } }),
    db.stockMovement.aggregate({ where: { itemId: id, type: "STOCK_OUT", occurredAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, _sum: { quantityChange: true } }),
  ]);
  return { item, totalSpend: toNumber(spend._sum.total), issued90: -(issued._sum.quantityChange ?? 0) };
}

type FullItem = NonNullable<Awaited<ReturnType<typeof getItem>>>["item"];

export function itemFormValues(i: FullItem): ItemInput {
  return {
    name: i.name,
    category: i.category,
    sku: i.sku,
    unit: i.unit,
    minQuantity: String(i.minQuantity),
    unitCost: i.unitCost?.toString() ?? "",
    locationId: i.locationId ?? "",
    vendorId: i.vendorId ?? "",
    notes: i.notes ?? "",
  };
}

/** Pickers for item and movement forms. */
export async function getInventoryLookups() {
  const [locations, vendors, employees, tickets, categories] = await Promise.all([
    db.location.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({ where: { deletedAt: null, status: { not: "EXITED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.ticket.findMany({ where: { deletedAt: null, status: { notIn: ["CLOSED"] } }, orderBy: { seq: "desc" }, take: 200, select: { id: true, ticketNumber: true, title: true, requesterId: true } }),
    db.inventoryItem.findMany({ where: { deletedAt: null }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  return {
    locations: locations.map((l) => ({ value: l.id, label: l.name })),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    employees: employees.map((e) => ({ value: e.id, label: e.name })),
    tickets: tickets.map((t) => ({ value: t.id, label: `${t.ticketNumber} · ${t.title}`, requesterId: t.requesterId })),
    categories: categories.map((c) => c.category),
  };
}
export type InventoryLookups = Awaited<ReturnType<typeof getInventoryLookups>>;
