import "server-only";
import type { AuditAction } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { HOUR_MS, parseDateInput } from "@/lib/dates";

export const AUDIT_LIMIT = 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIONS: AuditAction[] = ["CREATE", "UPDATE", "DELETE", "RESTORE", "REVEAL"];

export type AuditFilters = { from: string; to: string; entity: string; action: string; actor: string };

export function resolveAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    from: DATE_RE.test(s("from")) ? s("from") : "",
    to: DATE_RE.test(s("to")) ? s("to") : "",
    entity: s("entity").slice(0, 60),
    action: ACTIONS.includes(s("action") as AuditAction) ? s("action") : "",
    actor: s("actor").slice(0, 40),
  };
}

/** Where an audited record lives in the app, when it has its own page. */
function hrefFor(entityType: string, entityId: string) {
  const map: Record<string, string> = {
    Asset: "/assets/",
    Employee: "/employees/",
    Vendor: "/vendors/",
    Subscription: "/subscriptions/",
    Ticket: "/tickets/",
    InventoryItem: "/inventory/",
    License: "/licenses/",
  };
  return map[entityType] ? `${map[entityType]}${entityId}` : null;
}

export async function listAudit(f: AuditFilters) {
  // Dates are IST calendar days.
  const createdAt = {
    ...(f.from ? { gte: new Date(parseDateInput(f.from).getTime() - 5.5 * HOUR_MS) } : {}),
    ...(f.to ? { lt: new Date(parseDateInput(f.to).getTime() + 24 * HOUR_MS - 5.5 * HOUR_MS) } : {}),
  };
  const [rows, entityTypes, actors] = await Promise.all([
    db.auditLog.findMany({
      where: {
        ...(f.from || f.to ? { createdAt } : {}),
        ...(f.entity ? { entityType: f.entity } : {}),
        ...(f.action ? { action: f.action as AuditAction } : {}),
        ...(f.actor === "system" ? { actorId: null } : f.actor ? { actorId: f.actor } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: AUDIT_LIMIT,
      include: { actor: { select: { name: true } } },
    }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      entityLabel: r.entityLabel,
      actor: r.actor?.name ?? "System",
      href: hrefFor(r.entityType, r.entityId),
      before: r.before,
      after: r.after,
      diff: r.diff as Record<string, { from: unknown; to: unknown }> | null,
    })),
    entityTypes: entityTypes.map((e) => e.entityType),
    actors,
  };
}
export type AuditRow = Awaited<ReturnType<typeof listAudit>>["rows"][number];
