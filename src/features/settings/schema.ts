import { z } from "zod";
import { requiredText, text } from "@/lib/validation";

export const companySchema = z.object({
  name: requiredText("Company name", 160),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v), "Enter a valid 15-character GSTIN"),
  address: text(500),
  defaultSalvagePercent: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter a percentage between 0 and 99"),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const ROLES = ["ADMIN", "IT_STAFF", "VIEWER"] as const;

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Mix letters and numbers");

export const userCreateSchema = z.object({
  name: requiredText("Name", 120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role: z.enum(ROLES),
  password,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: requiredText("Name", 120),
  role: z.enum(ROLES),
  active: z.boolean(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const resetPasswordSchema = z.object({ id: z.string().min(1), password });

export const CHART_KEYS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "chart-7"] as const;

export const expenseCategorySchema = z.object({
  id: z.string().optional(),
  name: requiredText("Name", 60),
  colorKey: z.enum(CHART_KEYS),
});

export const ticketCategorySchema = z.object({
  id: z.string().optional(),
  name: requiredText("Name", 60),
});
