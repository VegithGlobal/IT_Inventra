import "server-only";
import type { Tx } from "@/lib/db";

/** Categories used by auto-created expenses. Recreated if someone renamed them away. */
export const SYSTEM_CATEGORIES = {
  hardware: { name: "Hardware", colorKey: "chart-1" },
  subscriptions: { name: "Subscriptions", colorKey: "chart-2" },
  consumables: { name: "Consumables", colorKey: "chart-3" },
  maintenance: { name: "Repairs & Maintenance", colorKey: "chart-4" },
  licenses: { name: "Software Licenses", colorKey: "chart-6" },
} as const;

export async function systemCategoryId(tx: Tx, key: keyof typeof SYSTEM_CATEGORIES) {
  const def = SYSTEM_CATEGORIES[key];
  const found = await tx.expenseCategory.findUnique({ where: { name: def.name } });
  if (found) return found.id;
  const created = await tx.expenseCategory.create({ data: { name: def.name, colorKey: def.colorKey, isSystem: true } });
  return created.id;
}
