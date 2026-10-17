"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDateTime } from "@/lib/format";
import type { AuditFilters, AuditRow } from "./queries";

const ACTION: Record<string, { label: string; tone: Tone }> = {
  CREATE: { label: "Created", tone: "success" },
  UPDATE: { label: "Updated", tone: "info" },
  DELETE: { label: "Archived", tone: "danger" },
  RESTORE: { label: "Restored", tone: "brand" },
  REVEAL: { label: "Viewed secret", tone: "warning" },
};
/** "AssetAssignment" → "Asset assignment" */
const entityLabel = (t: string) => t.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`);

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.endsWith("T00:00:00.000Z") ? v.slice(0, 10) : formatDateTime(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Snapshot({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return <p className="text-[13px] text-fg-muted">—</p>;
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
      {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-fg-muted">{k}</dt>
          <dd className="min-w-0 break-words text-fg">{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditView({
  rows,
  filters,
  entityTypes,
  actors,
  limit,
}: {
  rows: AuditRow[];
  filters: AuditFilters;
  entityTypes: string[];
  actors: { id: string; name: string }[];
  limit: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(filters);
  const [open, setOpen] = useState<AuditRow | null>(null);
  const apply = (f: AuditFilters) => {
    const sp = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false });
  };
  const set = (k: keyof AuditFilters, v: string, now = false) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    if (now) apply(next);
  };

  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      { accessorKey: "createdAt", header: "When", sortingFn: "datetime", cell: ({ row }) => <span className="whitespace-nowrap tabular">{formatDateTime(row.original.createdAt)}</span>, meta: { csv: (r) => new Date(r.createdAt).toISOString() } },
      {
        accessorKey: "actor",
        header: "Who",
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Avatar name={row.original.actor} size="xs" />
            {row.original.actor}
          </span>
        ),
        meta: { csv: (r) => r.actor },
      },
      { accessorKey: "action", header: "Action", cell: ({ row }) => <Badge tone={ACTION[row.original.action].tone}>{ACTION[row.original.action].label}</Badge>, meta: { csv: (r) => r.action } },
      { accessorKey: "entityType", header: "Record type", cell: ({ row }) => entityLabel(row.original.entityType), meta: { csv: (r) => r.entityType } },
      {
        accessorKey: "entityLabel",
        header: "Record",
        cell: ({ row }) =>
          row.original.href ? (
            <Link href={row.original.href} onClick={(e) => e.stopPropagation()} className="line-clamp-1 max-w-96 hover:underline">
              {row.original.entityLabel ?? row.original.entityId}
            </Link>
          ) : (
            <span className="line-clamp-1 max-w-96">{row.original.entityLabel ?? row.original.entityId}</span>
          ),
        meta: { csv: (r) => r.entityLabel },
      },
      {
        id: "changes",
        accessorFn: (r) => Object.keys(r.diff ?? {}).join(", "),
        header: "Changed fields",
        enableSorting: false,
        cell: ({ row }) => {
          const keys = Object.keys(row.original.diff ?? {});
          return keys.length ? <span className="line-clamp-1 max-w-72 text-[12.5px] text-fg-secondary">{keys.join(", ")}</span> : <span className="text-fg-muted">—</span>;
        },
        meta: { csv: (r) => Object.keys(r.diff ?? {}).join("; ") },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit log" description="Every create, update and archive — who did it, what changed and when. Read-only." />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-secondary">From</span>
          <Input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} className="h-9 w-40" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-secondary">To</span>
          <Input type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} className="h-9 w-40" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-secondary">Record type</span>
          <NativeSelect value={draft.entity} onChange={(e) => set("entity", e.target.value, true)} className="w-48">
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {entityLabel(t)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-secondary">Action</span>
          <NativeSelect value={draft.action} onChange={(e) => set("action", e.target.value, true)} className="w-36">
            <option value="">All</option>
            {Object.entries(ACTION).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-secondary">Who</span>
          <NativeSelect value={draft.actor} onChange={(e) => set("actor", e.target.value, true)} className="w-44">
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="system">System (scheduled jobs)</option>
          </NativeSelect>
        </label>
        <Button type="submit" variant="primary">
          Apply
        </Button>
        {Object.values(filters).some(Boolean) && (
          <Button
            variant="ghost"
            onClick={() => {
              const empty = { from: "", to: "", entity: "", action: "", actor: "" };
              setDraft(empty);
              apply(empty);
            }}
          >
            Clear
          </Button>
        )}
      </form>
      {rows.length >= limit && <p className="text-[12.5px] text-warning">Showing the latest {limit} entries — narrow the date range to see older ones.</p>}
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search record, field, person…"
        exportName="audit-log"
        getRowId={(r) => r.id}
        pageSize={50}
        onRowClick={setOpen}
        initialSorting={[{ id: "createdAt", desc: true }]}
        empty={<EmptyState icon={ScrollText} title="No audit entries" description="Changes made in the app appear here." />}
      />
      <SlideOver
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${ACTION[open.action].label} · ${entityLabel(open.entityType)}` : ""}
        description={open ? `${open.actor} · ${formatDateTime(open.createdAt)}` : undefined}
      >
        {open && (
          <div className="flex flex-col gap-6">
            <p className="text-[14px] font-medium text-fg">
              {open.href ? (
                <Link href={open.href} className="hover:underline">
                  {open.entityLabel ?? open.entityId}
                </Link>
              ) : (
                (open.entityLabel ?? open.entityId)
              )}
            </p>
            {open.diff && Object.keys(open.diff).length > 0 && (
              <section>
                <h3 className="mb-2 text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">Changes</h3>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-fg-muted">
                      <th className="py-1.5 pr-3 font-medium">Field</th>
                      <th className="py-1.5 pr-3 font-medium">Before</th>
                      <th className="py-1.5 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(open.diff).map(([k, c]) => (
                      <tr key={k} className="border-b border-line align-top">
                        <td className="py-1.5 pr-3 text-fg-secondary">{k}</td>
                        <td className="py-1.5 pr-3 break-words text-danger line-through decoration-danger/40">{show(c.from)}</td>
                        <td className="py-1.5 break-words text-success">{show(c.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {open.action !== "UPDATE" && (
              <section>
                <h3 className="mb-2 text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">{open.action === "CREATE" ? "Created with" : "Record at the time"}</h3>
                <Snapshot data={open.action === "CREATE" ? open.after : open.before} />
              </section>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
