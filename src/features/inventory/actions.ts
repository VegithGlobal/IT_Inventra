"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ActionError, createAction } from "@/lib/action";
import { istToUtc, parseDateInput } from "@/lib/dates";
import { toDecimalOrNull } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { systemCategoryId } from "@/features/expenses/system";
import { adjustSchema, itemCreateSchema, itemUpdateSchema, stockInSchema, stockOutSchema, type ItemInput } from "./schema";

const itemData = (v: ItemInput) => ({
  name: v.name,
  category: v.category,
  sku: v.sku,
  unit: v.unit,
  minQuantity: Number(v.minQuantity),
  unitCost: toDecimalOrNull(v.unitCost),
  locationId: orNull(v.locationId),
  vendorId: orNull(v.vendorId),
  notes: orNull(v.notes),
});

/** Movement time: the chosen date at noon IST (keeps same-day ordering sensible). */
const occurredAt = (date: string) => {
  const t = istToUtc(date, "12:00");
  return t > new Date() ? new Date() : t;
};

export const createItem = createAction({
  schema: itemCreateSchema,
  handler: async ({ openingQuantity, ...input }, { tx, audit, user }) => {
    const opening = Number(openingQuantity);
    const item = await tx.inventoryItem.create({ data: { ...itemData(input), quantity: opening } });
    if (opening > 0) {
      await tx.stockMovement.create({
        data: { itemId: item.id, type: "ADJUSTMENT", quantityChange: opening, quantityAfter: opening, notes: "Opening stock", createdById: user.id },
      });
    }
    await audit({ action: "CREATE", entityType: "InventoryItem", entityId: item.id, entityLabel: `${item.sku} · ${item.name}`, after: item });
    return { id: item.id };
  },
});

export const updateItem = createAction({
  schema: itemUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Item not found.");
    const after = await tx.inventoryItem.update({ where: { id }, data: itemData(data) });
    await audit({ action: "UPDATE", entityType: "InventoryItem", entityId: id, entityLabel: after.sku, before, after });
    return { id };
  },
});

export const archiveItem = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.inventoryItem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Item not found.");
    // Free the unique SKU so it can be reused.
    const after = await tx.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), sku: `${before.sku}~ARCHIVED~${Date.now()}` } });
    await audit({ action: "DELETE", entityType: "InventoryItem", entityId: id, entityLabel: `${before.sku} · ${before.name}`, before, after });
    return { id };
  },
});

/** Purchase: adds stock, updates the last unit cost, and (optionally) records a Consumables expense. */
export const stockIn = createAction({
  schema: stockInSchema,
  handler: async (v, { tx, audit, user }) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: v.itemId, deletedAt: null } });
    if (!item) throw new ActionError("Item not found.");
    const qty = Number(v.quantity);
    const unitCost = v.unitCost ? new Prisma.Decimal(v.unitCost) : item.unitCost;
    if (v.recordExpense && !unitCost) throw new ActionError("Enter the unit cost to record an expense.", { unitCost: "Needed for the expense" });

    const after = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { increment: qty }, ...(unitCost ? { unitCost } : {}), ...(v.vendorId ? { vendorId: v.vendorId } : {}) },
    });
    const movement = await tx.stockMovement.create({
      data: {
        itemId: item.id,
        type: "STOCK_IN",
        quantityChange: qty,
        quantityAfter: after.quantity,
        unitCost,
        invoiceNumber: orNull(v.invoiceNumber),
        notes: orNull(v.notes),
        occurredAt: occurredAt(v.date),
        createdById: user.id,
      },
    });
    await audit({ action: "CREATE", entityType: "StockMovement", entityId: movement.id, entityLabel: `+${qty} ${item.unit} · ${item.name}`, after: movement });
    await audit({ action: "UPDATE", entityType: "InventoryItem", entityId: item.id, entityLabel: item.sku, before: item, after });

    if (v.recordExpense && unitCost) {
      const total = unitCost.times(qty);
      const expense = await tx.expense.create({
        data: {
          date: parseDateInput(v.date),
          categoryId: await systemCategoryId(tx, "consumables"),
          description: `Stock in · ${qty} × ${item.name}`,
          amount: total,
          taxAmount: 0,
          total,
          vendorId: orNull(v.vendorId) ?? item.vendorId,
          transactionRef: orNull(v.invoiceNumber),
          paidBy: user.name,
          source: "STOCK_IN",
          inventoryItemId: item.id,
        },
      });
      await audit({ action: "CREATE", entityType: "Expense", entityId: expense.id, entityLabel: expense.description, after: expense });
    }
    return { quantity: after.quantity };
  },
});

/** Issue to an employee or use on a ticket. Never lets stock go negative, even under concurrency. */
export const stockOut = createAction({
  schema: stockOutSchema,
  handler: async (v, { tx, audit, user }) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: v.itemId, deletedAt: null } });
    if (!item) throw new ActionError("Item not found.");
    const qty = Number(v.quantity);
    const { count } = await tx.inventoryItem.updateMany({ where: { id: item.id, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
    if (count === 0) throw new ActionError(`Only ${item.quantity} ${item.unit} in stock.`, { quantity: `Only ${item.quantity} available` });
    const after = await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });

    const [employee, ticket] = await Promise.all([
      v.employeeId ? tx.employee.findFirst({ where: { id: v.employeeId, deletedAt: null }, select: { name: true } }) : null,
      v.ticketId ? tx.ticket.findFirst({ where: { id: v.ticketId, deletedAt: null }, select: { id: true, ticketNumber: true } }) : null,
    ]);
    const movement = await tx.stockMovement.create({
      data: {
        itemId: item.id,
        type: "STOCK_OUT",
        quantityChange: -qty,
        quantityAfter: after.quantity,
        unitCost: item.unitCost,
        employeeId: orNull(v.employeeId),
        ticketId: orNull(v.ticketId),
        notes: orNull(v.notes),
        occurredAt: occurredAt(v.date),
        createdById: user.id,
      },
    });
    if (ticket) {
      await tx.ticketComment.create({
        data: { ticketId: ticket.id, authorId: user.id, kind: "SYSTEM", body: `Used ${qty} × ${item.name} from stock${employee ? ` (given to ${employee.name})` : ""}` },
      });
    }
    await audit({ action: "CREATE", entityType: "StockMovement", entityId: movement.id, entityLabel: `−${qty} ${item.unit} · ${item.name}${employee ? ` → ${employee.name}` : ""}`, after: movement });
    await audit({ action: "UPDATE", entityType: "InventoryItem", entityId: item.id, entityLabel: item.sku, before: item, after });
    return { quantity: after.quantity, low: after.quantity <= after.minQuantity };
  },
});

/** Stock-take: set the counted quantity; the movement records the difference and the reason. */
export const adjustStock = createAction({
  schema: adjustSchema,
  handler: async (v, { tx, audit, user }) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: v.itemId, deletedAt: null } });
    if (!item) throw new ActionError("Item not found.");
    const next = Number(v.newQuantity);
    if (next === item.quantity) throw new ActionError("That's already the quantity on hand.", { newQuantity: "Same as current stock" });
    const after = await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: next } });
    const movement = await tx.stockMovement.create({
      data: { itemId: item.id, type: "ADJUSTMENT", quantityChange: next - item.quantity, quantityAfter: next, notes: v.reason, createdById: user.id },
    });
    await audit({ action: "CREATE", entityType: "StockMovement", entityId: movement.id, entityLabel: `Adjusted ${item.name}: ${item.quantity} → ${next}`, after: movement });
    await audit({ action: "UPDATE", entityType: "InventoryItem", entityId: item.id, entityLabel: item.sku, before: item, after });
    return { quantity: next };
  },
});
