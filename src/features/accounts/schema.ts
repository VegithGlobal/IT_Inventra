import { z } from "zod";
import { id, optionalDate, optionalId, optionalUrl, requiredText, text } from "@/lib/validation";

export const SYSTEM_CATEGORIES = ["EMAIL", "GOOGLE", "MICROSOFT", "SOFTWARE", "CLOUD", "DEV_TOOLS", "VPN_NETWORK", "FINANCE", "COMMUNICATION", "SOCIAL", "OTHER"] as const;
export const CLOSED_STATUSES = ["DISABLED", "DELETED", "TRANSFERRED"] as const;

export const systemSchema = z.object({
  name: requiredText("Name", 120),
  category: z.enum(SYSTEM_CATEGORIES),
  loginUrl: optionalUrl,
  vendorId: optionalId,
  offboardingSteps: text(2000),
  notes: text(2000),
});
export type SystemInput = z.infer<typeof systemSchema>;
export const systemUpdateSchema = z.object({ id: z.string().min(1), data: systemSchema });

export const accountSchema = z.object({
  employeeId: id("Employee"),
  systemId: id("System"),
  username: requiredText("Login ID", 200),
  accessLevel: text(80),
  mfaEnabled: z.boolean(),
  personal: z.boolean(),
  grantedAt: optionalDate,
  /** Plain text in the form only; stored AES-256-GCM encrypted. Blank on edit = keep. */
  password: text(500),
  clearPassword: z.boolean(),
  notes: text(2000),
});
export type AccountInput = z.infer<typeof accountSchema>;
export const accountUpdateSchema = z.object({ id: z.string().min(1), data: accountSchema });

export const closeAccountsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Choose at least one account").max(500),
  status: z.enum(CLOSED_STATUSES),
  note: text(500),
});
export type CloseAccountsInput = z.infer<typeof closeAccountsSchema>;

export const ACCOUNT_CSV_HEADERS = ["employee_id", "system", "login_id", "access_level", "mfa", "personal", "granted_on", "notes"] as const;

export const accountImportSchema = z.object({
  rows: z.array(z.array(z.string())).min(1, "The file has no rows").max(5000, "Import up to 5,000 rows at a time"),
});
