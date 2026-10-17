import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import { db } from "./db";

export type CompanySettings = {
  name: string;
  gstin?: string | null;
  address?: string | null;
  logoKey?: string | null;
  logoMime?: string | null;
  currency: string;
  timezone: string;
  dateFormat: string;
};

const DEFAULT_COMPANY: CompanySettings = { name: "Your Company", currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD-MM-YYYY" };

async function read<T>(key: string): Promise<Partial<T>> {
  const row = await db.setting.findUnique({ where: { key } });
  return (row?.value ?? {}) as Partial<T>;
}

export async function getCompany(): Promise<CompanySettings> {
  return { ...DEFAULT_COMPANY, ...(await read<CompanySettings>("company")) };
}

export async function getDepreciationDefaults(): Promise<{ defaultSalvagePercent: number }> {
  const v = await read<{ defaultSalvagePercent: number }>("depreciation");
  return { defaultSalvagePercent: v.defaultSalvagePercent ?? 5 };
}

export type ReminderSettings = {
  /** Days before a subscription's due date to notify (0 = on the day). */
  subscriptionDaysBefore: number[];
  warrantyDaysBefore: number;
  licenseDaysBefore: number[];
  ticketDueHoursBefore: number;
  assetReturnDaysBefore: number;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  subscriptionDaysBefore: [7, 3, 1, 0],
  warrantyDaysBefore: 30,
  licenseDaysBefore: [30, 7],
  ticketDueHoursBefore: 4,
  assetReturnDaysBefore: 2,
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  return { ...DEFAULT_REMINDERS, ...(await read<ReminderSettings>("reminders")) };
}

/** Notification types that can be emailed (SYSTEM is in-app only). */
export const EMAILABLE_TYPES = [
  "SUBSCRIPTION_DUE",
  "PAYMENT_OVERDUE",
  "WARRANTY_EXPIRY",
  "LICENSE_EXPIRY",
  "LOW_STOCK",
  "TICKET_DUE",
  "ASSET_RETURN_DUE",
  "MAINTENANCE_DUE",
  "REMINDER",
] as const satisfies readonly NotificationType[];
export type EmailableType = (typeof EMAILABLE_TYPES)[number];
export type EmailSettings = Record<EmailableType, boolean>;

export async function getEmailSettings(): Promise<EmailSettings> {
  const stored = await read<EmailSettings>("emailNotifications");
  return Object.fromEntries(EMAILABLE_TYPES.map((t) => [t, stored[t] ?? true])) as EmailSettings;
}
