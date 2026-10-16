import { today } from "./dates";
import { toNumber } from "./format";

type Num = number | string | { toString(): string } | null | undefined;

/**
 * Straight-line depreciation: cost falls linearly to the salvage value over the useful life,
 * counted in whole elapsed months since purchase.
 */
export function bookValue(opts: { cost: Num; purchaseDate: Date | null; usefulLifeMonths: number; salvagePercent: Num; asOf?: Date }) {
  const cost = toNumber(opts.cost);
  if (!cost || !opts.purchaseDate) return { bookValue: cost, depreciated: 0, monthsElapsed: 0, fullyDepreciated: false };
  const asOf = opts.asOf ?? today();
  const p = opts.purchaseDate;
  let months = (asOf.getUTCFullYear() - p.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - p.getUTCMonth());
  if (asOf.getUTCDate() < p.getUTCDate()) months -= 1;
  months = Math.max(0, months);

  const salvage = (cost * toNumber(opts.salvagePercent)) / 100;
  const life = Math.max(1, opts.usefulLifeMonths);
  const perMonth = (cost - salvage) / life;
  const depreciated = Math.min(cost - salvage, perMonth * months);
  return {
    bookValue: Math.round((cost - depreciated) * 100) / 100,
    depreciated: Math.round(depreciated * 100) / 100,
    monthsElapsed: months,
    fullyDepreciated: months >= life,
  };
}
