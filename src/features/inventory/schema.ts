import { z } from "zod";
import { dateStr, intStr, optionalId, optionalMoney, requiredText, text } from "@/lib/validation";

export const itemSchema = z.object({
  name: requiredText("Name", 160),
  category: requiredText("Category", 60),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "SKU is required")
    .max(60)
    .regex(/^[A-Z0-9][A-Z0-9-_.]*$/, "Letters, numbers and - _ . only"),
  unit: requiredText("Unit", 20),
  minQuantity: intStr("Reorder point", 0, 1_000_000),
  unitCost: optionalMoney,
  locationId: optionalId,
  vendorId: optionalId,
  notes: text(2000),
});
export type ItemInput = z.infer<typeof itemSchema>;
/** Opening stock is only set on create; afterwards every change is a movement. */
export const itemCreateSchema = itemSchema.extend({ openingQuantity: intStr("Opening quantity", 0, 1_000_000) });
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export const itemUpdateSchema = z.object({ id: z.string().min(1), data: itemSchema });

const qty = intStr("Quantity", 1, 1_000_000);

export const stockInSchema = z.object({
  itemId: z.string().min(1),
  quantity: qty,
  unitCost: optionalMoney,
  vendorId: optionalId,
  invoiceNumber: text(80),
  date: dateStr,
  recordExpense: z.boolean(),
  notes: text(1000),
});
export type StockInInput = z.infer<typeof stockInSchema>;

export const stockOutSchema = z
  .object({
    itemId: z.string().min(1),
    quantity: qty,
    employeeId: optionalId,
    ticketId: optionalId,
    date: dateStr,
    notes: text(1000),
  })
  .refine((v) => v.employeeId || v.ticketId || v.notes, { path: ["notes"], message: "Say who it went to, the ticket, or add a note" });
export type StockOutInput = z.infer<typeof stockOutSchema>;

export const adjustSchema = z.object({
  itemId: z.string().min(1),
  /** Physical count — the movement records the difference. */
  newQuantity: intStr("Counted quantity", 0, 1_000_000),
  reason: requiredText("Reason", 500),
});
export type AdjustInput = z.infer<typeof adjustSchema>;
