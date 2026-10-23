import { z } from "zod";
import { id, optionalDate, optionalId, optionalMoney, requiredText, text } from "@/lib/validation";

/** Statuses you can set by hand. ASSIGNED only comes from the check-out flow. */
export const MANUAL_STATUSES = ["IN_STOCK", "UNDER_REPAIR", "IN_TRANSIT", "LOST_STOLEN", "RETIRED", "DISPOSED"] as const;

export const assetSchema = z
  .object({
    name: requiredText("Name", 160),
    typeId: id("Type"),
    brand: text(80),
    model: text(120),
    serialNumber: z.string().trim().max(120),
    cpu: text(120),
    ram: text(60),
    storage: text(120),
    os: text(80),
    purchaseDate: optionalDate,
    purchaseCost: optionalMoney,
    vendorId: optionalId,
    invoiceNumber: text(80),
    warrantyStart: optionalDate,
    warrantyEnd: optionalDate,
    locationId: optionalId,
    departmentId: optionalId,
    condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]),
    status: z.enum([...MANUAL_STATUSES, "ASSIGNED"]),
    notes: text(4000),
    /** On create: also record the purchase as an expense. */
    recordExpense: z.boolean(),
  })
  .refine((v) => !v.warrantyEnd || !v.warrantyStart || v.warrantyEnd >= v.warrantyStart, {
    path: ["warrantyEnd"],
    message: "Warranty end must be after the start",
  })
  .refine((v) => !v.recordExpense || (v.purchaseCost !== "" && v.purchaseDate !== ""), {
    path: ["purchaseCost"],
    message: "Enter the purchase date and cost to record an expense",
  });

export type AssetInput = z.infer<typeof assetSchema>;
export const assetUpdateSchema = z.object({ id: z.string().min(1), data: assetSchema });

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(MANUAL_STATUSES),
});

export const deleteAssetsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

export const ASSET_CSV_HEADERS = [
  "name",
  "type",
  "brand",
  "model",
  "serial_number",
  "purchase_date",
  "purchase_cost",
  "vendor",
  "invoice_number",
  "warranty_end",
  "location",
  "condition",
  "notes",
] as const;

export const assetImportSchema = z.object({
  rows: z.array(z.array(z.string())).min(1, "The file has no rows").max(2000, "Import up to 2,000 rows at a time"),
});
