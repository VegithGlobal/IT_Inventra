import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";

type Entry = {
  id: string;
  action: string;
  entityLabel: string | null;
  diff: unknown;
  createdAt: Date;
  actor: { name: string } | null;
};

const VERB: Record<string, string> = { CREATE: "created", UPDATE: "updated", DELETE: "archived", RESTORE: "restored", REVEAL: "viewed the password of" };
const HIDDEN = new Set(["id", "deletedAt", "currentHolderId", "typeId", "vendorId", "locationId", "departmentId", "employeeId", "systemId", "closedById"]);

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Audit-log timeline for a single record. */
export function ActivityList({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-[13.5px] text-fg-muted">No activity recorded yet.</div>;
  }
  return (
    <ol className="rounded-xl border border-line bg-surface">
      {entries.map((e) => {
        const changes = Object.entries((e.diff ?? {}) as Record<string, { from: unknown; to: unknown }>).filter(([k]) => !HIDDEN.has(k));
        return (
          <li key={e.id} className="flex gap-3 border-b border-line px-5 py-3.5 last:border-0">
            <Avatar name={e.actor?.name ?? "System"} size="sm" />
            <div className="min-w-0 flex-1 text-[13.5px]">
              <p className="text-fg">
                <span className="font-medium">{e.actor?.name ?? "System"}</span> <span className="text-fg-secondary">{VERB[e.action] ?? e.action.toLowerCase()}</span>{" "}
                {e.entityLabel}
              </p>
              {changes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[12.5px] text-fg-muted">
                  {changes.slice(0, 6).map(([k, c]) => (
                    <li key={k} className="truncate">
                      {k}: <span className="line-through decoration-fg-muted/40">{show(c.from)}</span> → <span className="text-fg-secondary">{show(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-0.5 text-[12px] text-fg-muted">{formatDateTime(e.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
