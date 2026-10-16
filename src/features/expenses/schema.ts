import { z } from "zod";
import { dateStr, id, money, optionalId, optionalMoney, requiredText, text, optionalFile } from "@/lib/validation";
import { PAYMENT_MODES } from "@/features/subscriptions/schema";

export const LINK_TYPES = ["", "asset", "subscription", "ticket", "inventoryItem"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const expenseSchema = z
  .object({
    date: dateStr,
    categoryId: id("Category"),
    description: requiredText("Description", 300),
    amount: money(),
    taxAmount: optionalMoney,
    vendorId: optionalId,
    paymentMode: z.union([z.enum(PAYMENT_MODES), z.literal("")]),
    transactionRef: text(120),
    paidBy: text(120),
    notes: text(2000),
    linkType: z.enum(LINK_TYPES),
    linkId: optionalId,
  })
  .refine((v) => !v.linkType || v.linkId !== "", { path: ["linkId"], message: "Choose the record to link" });

export type ExpenseInput = z.infer<typeof expenseSchema>;


export const expenseActionSchema = expenseSchema.and(z.object({ file: optionalFile, invoiceNumber: text(80).optional() }));
export const expenseUpdateSchema = z.object({ id: z.string().min(1), data: expenseSchema });
