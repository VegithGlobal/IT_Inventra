import "server-only";
import type { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "./db";

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
};

const IGNORED_FIELDS = new Set(["createdAt", "updatedAt"]);

/** Decimal → string, Date → ISO, drops functions — a plain JSON snapshot. */
function snapshot(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function diffOf(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before || !after) return null;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (IGNORED_FIELDS.has(key)) continue;
    const a = before[key];
    const b = after[key];
    if (typeof a === "object" || typeof b === "object") {
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
    } else if (a === b) continue;
    changes[key] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

const asJson = (v: unknown) => (v === null ? undefined : (v as Prisma.InputJsonValue));

/** Accepts a transaction or the plain client (e.g. for exports outside a transaction). */
export async function writeAudit(tx: Pick<Tx, "auditLog">, actorId: string | null, entry: AuditEntry) {
  const before = snapshot(entry.before);
  const after = snapshot(entry.after);
  const diff = entry.action === "UPDATE" ? diffOf(before, after) : null;
  if (entry.action === "UPDATE" && diff && Object.keys(diff).length === 0) return;
  await tx.auditLog.create({
    data: {
      actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel ?? null,
      before: asJson(before),
      after: asJson(after),
      diff: asJson(diff),
    },
  });
}
