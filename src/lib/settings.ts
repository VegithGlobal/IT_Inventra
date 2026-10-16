import "server-only";
import { db } from "./db";

export type CompanySettings = {
  name: string;
  gstin?: string | null;
  address?: string | null;
  logoKey?: string | null;
  currency: string;
  timezone: string;
  dateFormat: string;
};

const DEFAULT_COMPANY: CompanySettings = { name: "Your Company", currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD-MM-YYYY" };

export async function getCompany(): Promise<CompanySettings> {
  const row = await db.setting.findUnique({ where: { key: "company" } });
  return { ...DEFAULT_COMPANY, ...((row?.value as Partial<CompanySettings> | null) ?? {}) };
}

export type ReminderSettings = { subscriptionDaysBefore: number[] };

export async function getReminderSettings(): Promise<ReminderSettings> {
  const row = await db.setting.findUnique({ where: { key: "reminders" } });
  const v = (row?.value ?? {}) as Partial<ReminderSettings>;
  return { subscriptionDaysBefore: v.subscriptionDaysBefore ?? [7, 3, 1, 0] };
}
