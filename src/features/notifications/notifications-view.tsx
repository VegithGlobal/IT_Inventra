"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BellOff, CheckCheck, Mail } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useActionRunner } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationsRead } from "./actions";
import { NOTIFICATION_META, relativeTime } from "./meta";
import type { NotificationRow } from "./queries";

export function NotificationsView({ rows }: { rows: NotificationRow[] }) {
  const [scope, setScope] = useState<"unread" | "all">(rows.some((r) => !r.readAt) ? "unread" : "all");
  const { pending, run } = useActionRunner();
  const unread = rows.filter((r) => !r.readAt).length;
  const data = scope === "unread" ? rows.filter((r) => !r.readAt) : rows;

  const columns = useMemo<ColumnDef<NotificationRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Notification",
        cell: ({ row }) => {
          const n = row.original;
          const meta = NOTIFICATION_META[n.type];
          const Icon = meta.icon;
          return (
            <div className="flex min-w-0 items-start gap-3 py-1">
              <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle", !n.readAt && "bg-brand-soft")}>
                <Icon className={cn("size-3.5 text-fg-muted", !n.readAt && "text-brand-text")} aria-hidden />
              </span>
              <div className="min-w-0">
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={() => !n.readAt && run(() => markNotificationsRead({ ids: [n.id], read: true }))}
                    className={cn("block truncate hover:underline", n.readAt ? "text-fg-secondary" : "font-medium text-fg")}
                  >
                    {n.title}
                  </Link>
                ) : (
                  <p className={cn("truncate", n.readAt ? "text-fg-secondary" : "font-medium text-fg")}>{n.title}</p>
                )}
                {n.body && <p className="truncate text-[12.5px] text-fg-muted">{n.body}</p>}
              </div>
            </div>
          );
        },
        meta: { csv: (r) => r.title },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <Badge tone={NOTIFICATION_META[row.original.type].tone}>{NOTIFICATION_META[row.original.type].label}</Badge>,
        meta: { csv: (r) => NOTIFICATION_META[r.type].label },
      },
      {
        accessorKey: "createdAt",
        header: "When",
        sortingFn: "datetime",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-fg-secondary" title={formatDateTime(row.original.createdAt)}>
            {relativeTime(row.original.createdAt)}
          </span>
        ),
        meta: { csv: (r) => new Date(r.createdAt).toISOString() },
      },
      {
        id: "emailed",
        accessorFn: (r) => (r.emailedAt ? "Emailed" : ""),
        header: "Email",
        cell: ({ row }) => (row.original.emailedAt ? <Mail className="size-4 text-fg-muted" aria-label={`Emailed ${formatDateTime(row.original.emailedAt)}`} /> : null),
        meta: { csv: (r) => (r.emailedAt ? new Date(r.emailedAt).toISOString() : "") },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-32 text-right" },
        cell: ({ row }) => (
          <button
            type="button"
            className="text-[12.5px] font-medium text-fg-muted opacity-0 group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
            onClick={() => run(() => markNotificationsRead({ ids: [row.original.id], read: !row.original.readAt }))}
          >
            Mark as {row.original.readAt ? "unread" : "read"}
          </button>
        ),
      },
    ],
    [run],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Renewals, expiries, low stock, due returns and your own reminders."
        actions={
          <>
            <Button asChild>
              <Link href="/settings/notifications">Notification settings</Link>
            </Button>
            {unread > 0 && (
              <Button variant="primary" disabled={pending} onClick={() => run(() => markAllNotificationsRead({}), "All caught up")}>
                <CheckCheck />
                Mark all read
              </Button>
            )}
          </>
        }
      />
      <div className="flex gap-1 self-start rounded-md border border-line bg-surface p-0.5 text-[13px]" role="group" aria-label="Show">
        {(
          [
            ["unread", `Unread (${unread})`],
            ["all", `All (${rows.length})`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={scope === key} onClick={() => setScope(key)} className={cn("rounded px-3 py-1 font-medium text-fg-muted", scope === key && "bg-subtle text-fg")}>
            {label}
          </button>
        ))}
      </div>
      <DataTable
        key={scope}
        data={data}
        columns={columns}
        searchPlaceholder="Search notifications…"
        exportName="notifications"
        getRowId={(r) => r.id}
        pageSize={50}
        initialSorting={[{ id: "createdAt", desc: true }]}
        filters={[
          {
            columnId: "type",
            label: "Type",
            options: Object.entries(NOTIFICATION_META)
              .filter(([k]) => rows.some((r) => r.type === k))
              .map(([value, m]) => ({ value, label: m.label })),
          },
        ]}
        bulkActions={(selected, clear) => (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => markNotificationsRead({ ids: selected.map((s) => s.id), read: true }), undefined, clear)}>
              Mark read
            </Button>
            <Button size="sm" disabled={pending} onClick={() => run(() => markNotificationsRead({ ids: selected.map((s) => s.id), read: false }), undefined, clear)}>
              Mark unread
            </Button>
          </>
        )}
        empty={
          <EmptyState
            icon={BellOff}
            title={scope === "unread" ? "You're all caught up" : "No notifications yet"}
            description="Reminders are generated by the scheduled job. You can also run it now from the Reminders page."
            action={
              <Button asChild>
                <Link href="/reminders">Go to reminders</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
