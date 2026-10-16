"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ActionError, createAction } from "@/lib/action";
import { parseDateInput } from "@/lib/dates";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { toDecimal } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { expenseActionSchema, expenseUpdateSchema, type ExpenseInput } from "./schema";

/** Amount entered is the total paid; GST (if given) is split out of it. */
function toData(v: ExpenseInput) {
  const total = toDecimal(v.amount);
  const tax = v.taxAmount ? toDecimal(v.taxAmount) : new Prisma.Decimal(0);
  if (tax.greaterThan(total)) throw new ActionError("GST can't exceed the total.", { taxAmount: "GST can't exceed the total" });
  const link = (type: ExpenseInput["linkType"]) => (v.linkType === type ? orNull(v.linkId) : null);
  return {
    date: parseDateInput(v.date),
    categoryId: v.categoryId,
    description: v.description,
    amount: total.minus(tax),
    taxAmount: tax,
    total,
    vendorId: orNull(v.vendorId),
    paymentMode: v.paymentMode || null,
    transactionRef: orNull(v.transactionRef),
    paidBy: orNull(v.paidBy),
    notes: orNull(v.notes),
    assetId: link("asset"),
    subscriptionId: link("subscription"),
    ticketId: link("ticket"),
    inventoryItemId: link("inventoryItem"),
  };
}

export const createExpense = createAction({
  schema: expenseActionSchema,
  handler: async ({ file, invoiceNumber, ...input }, { tx, audit, user }) => {
    const expense = await tx.expense.create({ data: { ...toData(input), source: "MANUAL" } });
    await audit({ action: "CREATE", entityType: "Expense", entityId: expense.id, entityLabel: expense.description, after: expense });
    if (file) {
      let stored;
      try {
        stored = await saveUpload(file, "documents");
      } catch (e) {
        if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
        throw e;
      }
      try {
        const doc = await tx.document.create({
          data: {
            type: "INVOICE",
            title: expense.description,
            ...stored,
            invoiceNumber: orNull(invoiceNumber),
            invoiceDate: expense.date,
            vendorId: expense.vendorId,
            amount: expense.total,
            expenseId: expense.id,
            assetId: expense.assetId,
            subscriptionId: expense.subscriptionId,
            ticketId: expense.ticketId,
            uploadedById: user.id,
          },
        });
        await audit({ action: "CREATE", entityType: "Document", entityId: doc.id, entityLabel: doc.title, after: doc });
      } catch (e) {
        await storage.delete(stored.fileKey);
        throw e;
      }
    }
    return { id: expense.id };
  },
});

export const updateExpense = createAction({
  schema: expenseUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.expense.findFirst({ where: { id, deletedAt: null }, include: { subscriptionPayment: true } });
    if (!before) throw new ActionError("Expense not found.");
    const next = toData(data);
    // Subscription payments own their money/date — change them by voiding the payment.
    if (before.subscriptionPayment && (!before.total.equals(next.total) || before.date.getTime() !== next.date.getTime())) {
      throw new ActionError("This expense comes from a subscription payment. Void the payment on the subscription to change its amount or date.");
    }
    const after = await tx.expense.update({ where: { id }, data: next });
    await audit({ action: "UPDATE", entityType: "Expense", entityId: id, entityLabel: after.description, before: { ...before, subscriptionPayment: undefined }, after });
    return { id };
  },
});

export const archiveExpense = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.expense.findFirst({ where: { id, deletedAt: null }, include: { subscriptionPayment: true } });
    if (!before) throw new ActionError("Expense not found.");
    if (before.subscriptionPayment) throw new ActionError("This expense belongs to a subscription payment. Void the payment on the subscription instead.");
    const after = await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Expense", entityId: id, entityLabel: before.description, before: { ...before, subscriptionPayment: undefined }, after });
    return { id };
  },
});
