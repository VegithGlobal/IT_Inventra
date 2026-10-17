import { z } from "zod";
import { intStr, optionalDate, optionalId, optionalMoney, requiredText, text } from "@/lib/validation";

export const LICENSE_TYPES = ["PER_USER", "PER_DEVICE", "SITE"] as const;

export const licenseSchema = z
  .object({
    name: requiredText("Name", 160),
    vendorId: optionalId,
    type: z.enum(LICENSE_TYPES),
    totalSeats: intStr("Seats", 1, 100_000),
    purchaseDate: optionalDate,
    expiryDate: optionalDate,
    cost: optionalMoney,
    subscriptionId: optionalId,
    /** Plain text in the form only; stored AES-256-GCM encrypted. Blank on edit = keep. */
    licenseKey: text(2000),
    clearKey: z.boolean(),
    notes: text(2000),
    /** On create: record the cost as a Software Licenses expense. */
    recordExpense: z.boolean(),
  })
  .refine((v) => !v.expiryDate || !v.purchaseDate || v.expiryDate >= v.purchaseDate, { path: ["expiryDate"], message: "Expiry can't be before the purchase date" })
  .refine((v) => !v.recordExpense || (v.cost !== "" && v.purchaseDate !== ""), { path: ["cost"], message: "Enter the cost and purchase date to record an expense" });
export type LicenseInput = z.infer<typeof licenseSchema>;
export const licenseUpdateSchema = z.object({ id: z.string().min(1), data: licenseSchema });

export const assignSeatSchema = z
  .object({
    licenseId: z.string().min(1),
    employeeId: optionalId,
    assetId: optionalId,
    notes: text(500),
  })
  .refine((v) => v.employeeId || v.assetId, { path: ["employeeId"], message: "Choose an employee or a device" });
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;

export const revokeSeatSchema = z.object({ seatId: z.string().min(1) });
