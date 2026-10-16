// Formatting helpers shared by server and client. Calendar dates (@db.Date) are stored as
// UTC midnight, so they're formatted in UTC; timestamps are shown in the company timezone.

export const APP_TIMEZONE = "Asia/Kolkata";

type MoneyLike = number | string | { toString(): string } | null | undefined;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function toNumber(value: MoneyLike): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** ₹1,23,456.00 */
export function formatMoney(value: MoneyLike, currency = "INR"): string {
  if (value === null || value === undefined) return "—";
  if (currency !== "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(toNumber(value));
  }
  return inr.format(toNumber(value));
}

/** ₹1,23,456 — for stat cards and charts */
export function formatMoneyShort(value: MoneyLike): string {
  return inrCompact.format(toNumber(value));
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIMEZONE,
});

/** 15 Oct 2026 — for calendar-date columns */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(new Date(value));
}

/** 15 Oct 2026, 14:05 — for timestamps */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFmt.format(new Date(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
