import { z } from "zod";
import { dateStr, id, optionalDate, optionalId, optionalMoney, requiredText, text } from "@/lib/validation";

export const maintenanceSchema = z
  .object({
    assetId: id("Asset"),
    issue: requiredText("Issue", 500),
    sentAt: dateStr,
    vendorId: optionalId,
    expectedReturnAt: optionalDate,
    underWarranty: z.boolean(),
    cost: optionalMoney,
    ticketId: optionalId,
    notes: text(4000),
  })
  .refine((v) => !v.expectedReturnAt || v.expectedReturnAt >= v.sentAt, { path: ["expectedReturnAt"], message: "Expected return can't be before the date sent" });
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
export const maintenanceUpdateSchema = z.object({ id: z.string().min(1), data: maintenanceSchema });

export const RETURN_STATUSES = ["PREVIOUS", "IN_STOCK", "RETIRED", "DISPOSED"] as const;

export const closeMaintenanceSchema = z.object({
  id: z.string().min(1),
  returnedAt: dateStr,
  outcome: requiredText("Outcome", 1000),
  cost: optionalMoney,
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]),
  /** Where the asset goes back to. PREVIOUS = the status before it was sent. */
  assetStatus: z.enum(RETURN_STATUSES),
});
export type CloseMaintenanceInput = z.infer<typeof closeMaintenanceSchema>;
