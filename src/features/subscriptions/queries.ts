import "server-only";
import { db } from "@/lib/db";
import { monthlyEquivalent } from "@/lib/billing";
import { daysBetween, toDateInput, today } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { SubscriptionInput } from "./schema";

export async function listSubscriptions() {
  const t = today();
  const subs = await db.subscription.findMany({
    where: { deletedAt: null },
    orderBy: { nextDueDate: "asc" },
    include: {
      vendor: { select: { id: true, name: true } },
      location: { select: { name: true } },
      department: { select: { name: true } },
      payments: { orderBy: { paidAt: "desc" }, take: 1, select: { paidAt: true, amount: true } },
    },
  });
  return subs.map((s) => {
    const amount = toNumber(s.amount);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      vendor: s.vendor?.name ?? null,
      vendorId: s.vendor?.id ?? null,
      accountId: s.accountId,
      planDetails: s.planDetails,
      amount,
      currency: s.currency,
      billingCycle: s.billingCycle,
      customCycleDays: s.customCycleDays,
      nextDueDate: s.nextDueDate,
      daysUntilDue: daysBetween(t, s.nextDueDate),
      autoRenew: s.autoRenew,
      paymentMode: s.paymentMode,
      status: s.status,
      location: s.location?.name ?? null,
      department: s.department?.name ?? null,
      lastPaidAt: s.payments[0]?.paidAt ?? null,
      monthly: s.status === "ACTIVE" ? monthlyEquivalent(amount, s.billingCycle, s.customCycleDays) : 0,
    };
  });
}
export type SubscriptionRow = Awaited<ReturnType<typeof listSubscriptions>>[number];

export async function getSubscription(id: string) {
  const sub = await db.subscription.findFirst({
    where: { id, deletedAt: null },
    include: {
      vendor: true,
      location: true,
      department: true,
      payments: { orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }], include: { createdBy: { select: { name: true } } } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      licenses: { where: { deletedAt: null }, select: { id: true, name: true, totalSeats: true } },
    },
  });
  if (!sub) return null;
  const [activity, paidTotal] = await Promise.all([
    db.auditLog.findMany({
      where: { OR: [{ entityType: "Subscription", entityId: id }, { entityType: "SubscriptionPayment", entityId: { in: sub.payments.map((p) => p.id) } }] },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.expense.aggregate({ where: { subscriptionId: id, deletedAt: null }, _sum: { total: true } }),
  ]);
  return { sub, activity, paidTotal: toNumber(paidTotal._sum.total) };
}

type FullSub = NonNullable<Awaited<ReturnType<typeof getSubscription>>>["sub"];

export function subscriptionFormValues(s: FullSub): SubscriptionInput {
  return {
    name: s.name,
    category: s.category,
    vendorId: s.vendorId ?? "",
    accountId: s.accountId ?? "",
    planDetails: s.planDetails ?? "",
    amount: s.amount.toString(),
    currency: s.currency,
    billingCycle: s.billingCycle,
    customCycleDays: s.customCycleDays ? String(s.customCycleDays) : "",
    startDate: toDateInput(s.startDate),
    nextDueDate: toDateInput(s.nextDueDate),
    autoRenew: s.autoRenew,
    paymentMode: s.paymentMode ?? "",
    locationId: s.locationId ?? "",
    departmentId: s.departmentId ?? "",
    loginUrl: s.loginUrl ?? "",
    credentials: "",
    clearCredentials: false,
    reminderDays: Array.isArray(s.reminderDays) ? (s.reminderDays as number[]).join(", ") : "",
    status: s.status,
    notes: s.notes ?? "",
  };
}

/** Active subscriptions, for the calendar. */
export async function listForCalendar() {
  const subs = await db.subscription.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, amount: true, billingCycle: true, customCycleDays: true, nextDueDate: true, category: true, vendor: { select: { name: true } } },
  });
  return subs.map((s) => ({ ...s, amount: toNumber(s.amount), vendor: s.vendor?.name ?? null }));
}
