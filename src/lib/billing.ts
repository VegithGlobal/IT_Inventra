import type { BillingCycle } from "@/generated/prisma/enums";
import { addDays, addMonths } from "./dates";

const MONTHS: Record<Exclude<BillingCycle, "CUSTOM">, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };

/** Move a due date by n billing cycles (negative n goes back). */
export function advanceCycle(date: Date, cycle: BillingCycle, customDays: number | null | undefined, n = 1): Date {
  if (cycle === "CUSTOM") return addDays(date, n * Math.max(1, customDays ?? 30));
  return addMonths(date, n * MONTHS[cycle]);
}

/** First due date on/after `from`, stepping whole cycles from the start date. */
export function firstDueOnOrAfter(start: Date, from: Date, cycle: BillingCycle, customDays?: number | null): Date {
  let due = start;
  for (let i = 0; due < from && i < 2000; i++) due = advanceCycle(start, cycle, customDays, i + 1);
  return due;
}

/** Normalised monthly cost, for run-rate totals. */
export function monthlyEquivalent(amount: number, cycle: BillingCycle, customDays?: number | null): number {
  if (cycle === "CUSTOM") return (amount * 30.4375) / Math.max(1, customDays ?? 30);
  return amount / MONTHS[cycle];
}

/** All due dates of a subscription falling inside [from, to] (for the calendar). */
export function dueDatesBetween(nextDue: Date, cycle: BillingCycle, customDays: number | null | undefined, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let d = nextDue;
  // Walk back to the first occurrence ≥ from (handles overdue dates before the window).
  for (let i = 0; d > from && i < 500; i++) {
    const prev = advanceCycle(d, cycle, customDays, -1);
    if (prev < from) break;
    d = prev;
  }
  for (let i = 0; d <= to && i < 500; i++) {
    if (d >= from) out.push(d);
    d = advanceCycle(d, cycle, customDays, 1);
  }
  return out;
}
