import { z } from "zod";
import { dateStr, id, optionalDate, text, optionalFile } from "@/lib/validation";

export const COMMON_ACCESSORIES = ["Charger", "Laptop bag", "Mouse", "Keyboard", "Headset", "Docking station", "Cover"] as const;

const condition = z.enum(["NEW", "GOOD", "FAIR", "POOR"]);

export const assignSchema = z
  .object({
    assetId: id("Asset"),
    employeeId: id("Employee"),
    issuedAt: dateStr,
    expectedReturnAt: optionalDate,
    conditionAtIssue: condition,
    /** Comma-separated list (FormData-friendly). */
    accessories: text(500),
    notes: text(2000),
  })
  .refine((v) => !v.expectedReturnAt || v.expectedReturnAt >= v.issuedAt, {
    path: ["expectedReturnAt"],
    message: "Expected return must be after the issue date",
  });
export type AssignInput = z.infer<typeof assignSchema>;
export const assignActionSchema = assignSchema.and(z.object({ file: optionalFile }));

export const checkInSchema = z.object({
  assignmentId: id("Assignment"),
  returnedAt: dateStr,
  conditionAtReturn: condition,
  newStatus: z.enum(["IN_STOCK", "UNDER_REPAIR"]),
  damageNotes: text(2000),
  returnNotes: text(2000),
});
export type CheckInInput = z.infer<typeof checkInSchema>;
export const checkInActionSchema = checkInSchema.and(z.object({ file: optionalFile }));

export const transferSchema = z.object({
  assetId: id("Asset"),
  toEmployeeId: id("Employee"),
  date: dateStr,
  condition,
  accessories: text(500),
  notes: text(2000),
});
export type TransferInput = z.infer<typeof transferSchema>;

/** One-click return used by the offboarding helper. */
export const quickReturnSchema = z.object({ assignmentId: id("Assignment") });

export function toFormData(values: Record<string, unknown>, file?: File | null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, String(v ?? ""));
  if (file) fd.set("file", file);
  return fd;
}
