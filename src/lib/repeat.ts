import type { RepeatRule } from "@/generated/prisma/enums";
import { addDays, addMonths } from "./dates";

/** Next occurrence for a repeating reminder, or null for one-off reminders. */
export function nextOccurrence(from: Date, rule: RepeatRule, everyDays?: number | null): Date | null {
  switch (rule) {
    case "NONE":
      return null;
    case "DAILY":
      return addDays(from, 1);
    case "WEEKLY":
      return addDays(from, 7);
    case "MONTHLY":
      return addMonths(from, 1);
    case "QUARTERLY":
      return addMonths(from, 3);
    case "HALF_YEARLY":
      return addMonths(from, 6);
    case "YEARLY":
      return addMonths(from, 12);
    case "CUSTOM_DAYS":
      return addDays(from, Math.max(1, everyDays ?? 1));
  }
}

/** Roll forward until strictly after `now` (so a long-missed repeating reminder fires once, not N times). */
export function nextOccurrenceAfter(from: Date, rule: RepeatRule, everyDays: number | null | undefined, now: Date): Date | null {
  let next = nextOccurrence(from, rule, everyDays);
  for (let i = 0; next && next <= now && i < 5000; i++) next = nextOccurrence(next, rule, everyDays);
  return next;
}
