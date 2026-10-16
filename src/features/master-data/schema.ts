import { z } from "zod";
import { intStr, requiredText, text } from "@/lib/validation";

export const departmentSchema = z.object({
  name: requiredText("Name", 80),
  code: z.string().trim().toUpperCase().max(10, "Keep the code under 10 characters"),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const locationSchema = z.object({
  name: requiredText("Name", 120),
  city: text(80),
  address: text(500),
  notes: text(1000),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const assetTypeSchema = z.object({
  name: requiredText("Name", 60),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, "Use 2–5 letters, e.g. LAP"),
  usefulLifeMonths: intStr("Useful life", 1, 240),
  salvagePercent: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter a percentage between 0 and 99"),
});
export type AssetTypeInput = z.infer<typeof assetTypeSchema>;

export const withId = <S extends z.ZodType>(data: S) => z.object({ id: z.string().min(1), data });
export const idOnly = z.object({ id: z.string().min(1) });
