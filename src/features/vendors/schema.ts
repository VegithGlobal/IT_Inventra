import { z } from "zod";
import { optionalEmail, optionalUrl, requiredText, text } from "@/lib/validation";

export const vendorSchema = z.object({
  name: requiredText("Name", 160),
  /** Built-in code (ISP, HARDWARE, …) or a category name added in Settings. */
  category: requiredText("Category", 60),
  contactPerson: text(120),
  phone: text(40),
  email: optionalEmail,
  address: text(500),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v), "Enter a valid 15-character GSTIN"),
  website: optionalUrl,
  notes: text(2000),
});

export type VendorInput = z.infer<typeof vendorSchema>;
export const vendorUpdateSchema = z.object({ id: z.string().min(1), data: vendorSchema });
