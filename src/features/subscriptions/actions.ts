"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ActionError, createAction } from "@/lib/action";
import { advanceCycle, firstDueOnOrAfter } from "@/lib/billing";
import { decrypt, encrypt } from "@/lib/crypto";
import { addDays, parseDateInput, today } from "@/lib/dates";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { toDecimal } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { systemCategoryId } from "@/features/expenses/system";
import { markPaidActionSchema, revealSchema, subscriptionSchema, subscriptionUpdateSchema, voidPaymentSchema, type SubscriptionInput } from "./schema";

function reminderDaysOf(v: string) {
  if (!v.trim()) return Prisma.DbNull;
  return [...new Set(v.split(",").map((d) => Number(d.trim())))].sort((a, b) => b - a);
}

function baseData(v: SubscriptionInput) {
  const customCycleDays = v.billingCycle === "CUSTOM" ? Number(v.customCycleDays) : null;
  const startDate = parseDateInput(v.startDate);
  return {
    name: v.name,
    category: v.category,
    vendorId: orNull(v.vendorId),
    accountId: orNull(v.accountId),
    planDetails: orNull(v.planDetails),
    amount: toDecimal(v.amount),
    currency: v.currency,
    billingCycle: v.billingCycle,
    customCycleDays,
    startDate,
    nextDueDate: v.nextDueDate ? parseDateInput(v.nextDueDate) : firstDueOnOrAfter(startDate, today(), v.billingCycle, customCycleDays),
    autoRenew: v.autoRenew,
    paymentMode: v.paymentMode || null,
    locationId: orNull(v.locationId),
    departmentId: orNull(v.departmentId),
    loginUrl: orNull(v.loginUrl),
    reminderDays: reminderDaysOf(v.reminderDays),
    status: v.status,
    notes: orNull(v.notes),
  };
}

/** Audit snapshots never include the ciphertext. */
const redact = <T extends { credentialsEnc?: string | null }>(s: T) => ({ ...s, credentialsEnc: s.credentialsEnc ? "••• (encrypted)" : null });

export const createSubscription = createAction({
  schema: subscriptionSchema,
  handler: async (input, { tx, audit }) => {
    const sub = await tx.subscription.create({ data: { ...baseData(input), credentialsEnc: input.credentials ? encrypt(input.credentials) : null } });
    await audit({ action: "CREATE", entityType: "Subscription", entityId: sub.id, entityLabel: sub.name, after: redact(sub) });
    return { id: sub.id };
  },
});

export const updateSubscription = createAction({
  schema: subscriptionUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Subscription not found.");
    const credentialsEnc = data.clearCredentials ? null : data.credentials ? encrypt(data.credentials) : before.credentialsEnc;
    const after = await tx.subscription.update({ where: { id }, data: { ...baseData(data), credentialsEnc } });
    await audit({ action: "UPDATE", entityType: "Subscription", entityId: id, entityLabel: after.name, before: redact(before), after: redact(after) });
    return { id };
  },
});

export const archiveSubscription = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Subscription not found.");
    const after = await tx.subscription.update({ where: { id }, data: { deletedAt: new Date(), status: "CANCELLED" } });
    await audit({ action: "DELETE", entityType: "Subscription", entityId: id, entityLabel: before.name, before: redact(before), after: redact(after) });
    return { id };
  },
});

/**
 * Mark as paid: records the payment for the current period, auto-creates the expense,
 * optionally stores the invoice, and moves the next due date forward one cycle.
 */
export const markSubscriptionPaid = createAction({
  schema: markPaidActionSchema,
  handler: async (v, { tx, audit, user }) => {
    const sub = await tx.subscription.findFirst({ where: { id: v.subscriptionId, deletedAt: null } });
    if (!sub) throw new ActionError("Subscription not found.");
    if (sub.status === "CANCELLED") throw new ActionError("This subscription is cancelled. Reactivate it before recording a payment.");

    const periodStart = sub.nextDueDate;
    const nextDue = advanceCycle(periodStart, sub.billingCycle, sub.customCycleDays);
    const periodEnd = addDays(nextDue, -1);
    const total = toDecimal(v.amount);
    const tax = v.taxAmount ? toDecimal(v.taxAmount) : new Prisma.Decimal(0);
    const paidAt = parseDateInput(v.paidAt);
    const periodLabel = periodStart.toISOString().slice(0, 7);

    const expense = await tx.expense.create({
      data: {
        date: paidAt,
        categoryId: await systemCategoryId(tx, "subscriptions"),
        description: `${sub.name} · ${periodLabel}`,
        amount: total.minus(tax),
        taxAmount: tax,
        total,
        vendorId: sub.vendorId,
        paymentMode: v.paymentMode,
        transactionRef: orNull(v.transactionRef),
        paidBy: user.name,
        notes: orNull(v.notes),
        source: "SUBSCRIPTION",
        subscriptionId: sub.id,
      },
    });
    const payment = await tx.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        paidAt,
        amount: total,
        paymentMode: v.paymentMode,
        transactionRef: orNull(v.transactionRef),
        periodStart,
        periodEnd,
        expenseId: expense.id,
        notes: orNull(v.notes),
        createdById: user.id,
      },
    });
    const after = await tx.subscription.update({ where: { id: sub.id }, data: { nextDueDate: nextDue } });

    await audit({ action: "CREATE", entityType: "Expense", entityId: expense.id, entityLabel: expense.description, after: expense });
    await audit({ action: "CREATE", entityType: "SubscriptionPayment", entityId: payment.id, entityLabel: `${sub.name} · paid ${v.paidAt}`, after: payment });
    await audit({ action: "UPDATE", entityType: "Subscription", entityId: sub.id, entityLabel: sub.name, before: redact(sub), after: redact(after) });

    if (v.file) {
      let stored;
      try {
        stored = await saveUpload(v.file, "documents");
      } catch (e) {
        if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
        throw e;
      }
      try {
        const doc = await tx.document.create({
          data: {
            type: "INVOICE",
            title: `${sub.name} invoice · ${periodLabel}`,
            ...stored,
            invoiceNumber: orNull(v.invoiceNumber),
            invoiceDate: paidAt,
            vendorId: sub.vendorId,
            amount: total,
            subscriptionId: sub.id,
            expenseId: expense.id,
            uploadedById: user.id,
          },
        });
        await audit({ action: "CREATE", entityType: "Document", entityId: doc.id, entityLabel: doc.title, after: doc });
      } catch (e) {
        await storage.delete(stored.fileKey);
        throw e;
      }
    }
    return { paymentId: payment.id, nextDueDate: nextDue };
  },
});

/** Undo the most recent payment: removes it, archives its expense and rolls the due date back. */
export const voidLatestPayment = createAction({
  schema: voidPaymentSchema,
  handler: async ({ paymentId }, { tx, audit }) => {
    const payment = await tx.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { subscription: true } });
    if (!payment) throw new ActionError("Payment not found.");
    const latest = await tx.subscriptionPayment.findFirst({ where: { subscriptionId: payment.subscriptionId }, orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }] });
    if (latest?.id !== payment.id) throw new ActionError("Only the most recent payment can be voided.");

    const sub = payment.subscription;
    await tx.subscriptionPayment.delete({ where: { id: payment.id } });
    if (payment.expenseId) {
      const exp = await tx.expense.findUnique({ where: { id: payment.expenseId } });
      if (exp && !exp.deletedAt) {
        const archived = await tx.expense.update({ where: { id: exp.id }, data: { deletedAt: new Date(), notes: `${exp.notes ? exp.notes + "\n" : ""}Voided with its subscription payment.` } });
        await audit({ action: "DELETE", entityType: "Expense", entityId: exp.id, entityLabel: exp.description, before: exp, after: archived });
      }
      // The invoice uploaded with this payment goes with it (soft delete; file kept).
      const docs = await tx.document.findMany({ where: { expenseId: payment.expenseId, deletedAt: null } });
      for (const doc of docs) {
        const archivedDoc = await tx.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
        await audit({ action: "DELETE", entityType: "Document", entityId: doc.id, entityLabel: doc.title, before: doc, after: archivedDoc });
      }
    }
    const after = await tx.subscription.update({ where: { id: sub.id }, data: { nextDueDate: payment.periodStart } });
    await audit({ action: "DELETE", entityType: "SubscriptionPayment", entityId: payment.id, entityLabel: `${sub.name} · voided payment`, before: { ...payment, subscription: undefined } });
    await audit({ action: "UPDATE", entityType: "Subscription", entityId: sub.id, entityLabel: sub.name, before: redact(sub), after: redact(after) });
    return { id: payment.id };
  },
});

/** Decrypts stored credentials for display. Not cached, not logged in plain text. */
export const revealCredentials = createAction({
  schema: revealSchema,
  handler: async ({ id }, { tx }) => {
    const sub = await tx.subscription.findFirst({ where: { id, deletedAt: null }, select: { credentialsEnc: true } });
    if (!sub?.credentialsEnc) throw new ActionError("No credentials stored for this subscription.");
    try {
      return { value: decrypt(sub.credentialsEnc) };
    } catch {
      throw new ActionError("Couldn't decrypt — was ENCRYPTION_KEY changed?");
    }
  },
});
