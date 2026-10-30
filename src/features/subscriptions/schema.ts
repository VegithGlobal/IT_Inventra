import { z } from "zod";
import { dateStr, id, money, optionalDate, optionalId, optionalMoney, optionalUrl, requiredText, text, optionalFile } from "@/lib/validation";

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"] as const;
export const PAYMENT_MODES = ["UPI", "CARD", "BANK_TRANSFER", "CASH", "CHEQUE"] as const;

export const subscriptionSchema = z
  .object({
    name: requiredText("Service name", 160),
    /** Built-in code (ISP, CLOUD, …) or a new category name typed by the user. */
    category: requiredText("Category", 60),
    vendorId: optionalId,
    accountId: text(120),
    planDetails: text(500),
    amount: money(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter code like INR"),
    billingCycle: z.enum(BILLING_CYCLES),
    customCycleDays: z.string().trim(),
    startDate: dateStr,
    /** Blank = calculate from the start date and cycle. */
    nextDueDate: optionalDate,
    autoRenew: z.boolean(),
    paymentMode: z.union([z.enum(PAYMENT_MODES), z.literal("")]),
    locationId: optionalId,
    departmentId: optionalId,
    loginUrl: optionalUrl,
    /** Plain text in the form only; stored AES-256-GCM encrypted. Blank on edit = keep. */
    credentials: text(1000),
    clearCredentials: z.boolean(),
    /** e.g. "7, 3, 1, 0" — blank uses the default from Settings. */
    reminderDays: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{1,3}(\s*,\s*\d{1,3})*$/.test(v), "Use whole days separated by commas, e.g. 7, 3, 1, 0"),
    status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]),
    notes: text(4000),
  })
  .refine((v) => v.billingCycle !== "CUSTOM" || (/^\d+$/.test(v.customCycleDays) && Number(v.customCycleDays) >= 1 && Number(v.customCycleDays) <= 3650), {
    path: ["customCycleDays"],
    message: "Enter the cycle length in days (1–3650)",
  })
  .refine((v) => !v.nextDueDate || v.nextDueDate >= v.startDate, { path: ["nextDueDate"], message: "Next due date can't be before the start date" });

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export const subscriptionUpdateSchema = z.object({ id: z.string().min(1), data: subscriptionSchema });


export const markPaidSchema = z
  .object({
    subscriptionId: id("Subscription"),
    paidAt: dateStr,
    amount: money("Amount paid"),
    /** GST included in the amount (optional) — split out on the expense. */
    taxAmount: optionalMoney,
    paymentMode: z.enum(PAYMENT_MODES),
    transactionRef: text(120),
    invoiceNumber: text(80),
    notes: text(1000),
  })
  .refine((v) => !v.taxAmount || Number(v.taxAmount) <= Number(v.amount), { path: ["taxAmount"], message: "GST can't exceed the amount paid" });
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
export const markPaidActionSchema = markPaidSchema.and(z.object({ file: optionalFile }));

export const voidPaymentSchema = z.object({ paymentId: id("Payment") });
export const revealSchema = z.object({ id: id("Subscription") });
