import { z } from "zod";
import { intStr } from "@/lib/validation";

const dayList = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\s*,\s*\d{1,3})*$/, "Use whole days separated by commas, e.g. 7, 3, 1, 0");

export const reminderSettingsSchema = z.object({
  subscriptionDaysBefore: dayList,
  warrantyDaysBefore: intStr("Warranty days", 0, 365),
  licenseDaysBefore: dayList,
  ticketDueHoursBefore: intStr("Hours", 0, 168),
  assetReturnDaysBefore: intStr("Days", 0, 60),
});
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;

export const emailSettingsSchema = z.object({
  SUBSCRIPTION_DUE: z.boolean(),
  PAYMENT_OVERDUE: z.boolean(),
  WARRANTY_EXPIRY: z.boolean(),
  LICENSE_EXPIRY: z.boolean(),
  LOW_STOCK: z.boolean(),
  TICKET_DUE: z.boolean(),
  ASSET_RETURN_DUE: z.boolean(),
  MAINTENANCE_DUE: z.boolean(),
  REMINDER: z.boolean(),
});
export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;

export const parseDayList = (v: string) => [...new Set(v.split(",").map((d) => Number(d.trim())))].sort((a, b) => b - a);
