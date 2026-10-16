import { APP_TIMEZONE } from "./format";

const DAY_MS = 86_400_000;

/** "2026-10-15" → Date at UTC midnight (how @db.Date columns are stored). */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function parseOptionalDate(value: string | null | undefined): Date | null {
  return value ? parseDateInput(value) : null;
}

/** Date → "2026-10-15" for <input type="date"> */
export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

/** Today's calendar date in the company timezone, as UTC midnight. */
export function today(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
  return parseDateInput(parts);
}

export function todayInput(): string {
  return toDateInput(today());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Add calendar months, clamping to the last day of the target month (31 Jan + 1M → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Keep the time of day (0 for @db.Date values; meaningful for reminder timestamps).
  const timeOfDay = ((date.getTime() % DAY_MS) + DAY_MS) % DAY_MS;
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)) + timeOfDay);
}

/** Whole days from a to b (b − a) for UTC-midnight dates. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── Date-times (reminders) — entered and shown in IST (UTC+05:30, no DST) ─────

const IST_OFFSET_MS = 330 * 60_000;

/** "2026-10-20" + "09:00" in IST → the UTC instant. */
export function istToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS);
}

/** UTC instant → { date: "2026-10-20", time: "09:00" } in IST, for form inputs. */
export function utcToIstInputs(value: Date | string): { date: string; time: string } {
  const ist = new Date(new Date(value).getTime() + IST_OFFSET_MS).toISOString();
  return { date: ist.slice(0, 10), time: ist.slice(11, 16) };
}

/** The IST calendar date of an instant, as UTC midnight (comparable with @db.Date values). */
export function istDateOf(value: Date): Date {
  return parseDateInput(utcToIstInputs(value).date);
}

export const HOUR_MS = 3_600_000;
