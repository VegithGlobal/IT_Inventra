"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, CalendarCheck2, Columns3, Plus, Search, Table2, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PriorityDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { istDateOf, today } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { TICKET_PRIORITY, TICKET_SOURCE, TICKET_STATUS, formatMinutes, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import { TicketBoard } from "./board";
import { TicketsPerMonthChart } from "./charts";
import type { TicketMetrics, TicketRow } from "./queries";
import { openQuickTicket } from "./quick-add";

type View = "board" | "table" | "today" | "insights";
const VIEWS: { key: View; label: string; icon: typeof Columns3 }[] = [
  { key: "board", label: "Board", icon: Columns3 },
  { key: "table", label: "Table", icon: Table2 },
  { key: "today", label: "My Today", icon: CalendarCheck2 },
  { key: "insights", label: "Insights", icon: BarChart3 },
];
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : "");
const isDone = (t: TicketRow) => t.status === "RESOLVED" || t.status === "CLOSED";

const columns: ColumnDef<TicketRow, unknown>[] = [
  {
    accessorKey: "ticketNumber",
    header: "Ticket",
    sortingFn: (a, b) => a.original.seq - b.original.seq,
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <PriorityDot priority={row.original.priority} />
        <span className="font-mono text-[12.5px] text-fg-muted">{row.original.ticketNumber}</span>
      </span>
    ),
    meta: { csv: (r) => r.ticketNumber },
  },
  { accessorKey: "title", header: "Title", cell: ({ row }) => <span className="line-clamp-1 max-w-96 font-medium">{row.original.title}</span>, meta: { csv: (r) => r.title } },
  {
    accessorKey: "requester",
    header: "Requester",
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <Avatar name={row.original.requester} size="xs" />
        {row.original.requester}
      </span>
    ),
    meta: { csv: (r) => r.requester },
  },
  { accessorKey: "category", header: "Category", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.category } },
  { accessorKey: "priority", header: "Priority", cell: ({ row }) => TICKET_PRIORITY[row.original.priority], meta: { csv: (r) => r.priority } },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge tone={TICKET_STATUS[row.original.status].tone} dot>
        {TICKET_STATUS[row.original.status].label}
      </Badge>
    ),
    meta: { csv: (r) => TICKET_STATUS[r.status].label },
  },
  { accessorKey: "source", header: "Source", cell: ({ row }) => TICKET_SOURCE[row.original.source], meta: { csv: (r) => TICKET_SOURCE[r.source] } },
  { accessorKey: "asset", header: "Asset", cell: ({ getValue }) => <span className="font-mono text-[12.5px]">{String(getValue() ?? "—")}</span>, meta: { csv: (r) => r.asset } },
  {
    accessorKey: "dueDate",
    header: "Due",
    sortingFn: "datetime",
    cell: ({ row }) => <span className={cn("whitespace-nowrap", row.original.overdue && "font-medium text-danger")}>{row.original.dueDate ? formatDateTime(row.original.dueDate) : "—"}</span>,
    meta: { csv: (r) => iso(r.dueDate) },
  },
  { accessorKey: "createdAt", header: "Opened", sortingFn: "datetime", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>, meta: { csv: (r) => iso(r.createdAt) } },
  { accessorKey: "resolvedAt", header: "Resolved", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.resolvedAt), meta: { csv: (r) => iso(r.resolvedAt) } },
  { accessorKey: "timeSpentMinutes", header: "Time", cell: ({ row }) => formatMinutes(row.original.timeSpentMinutes), meta: { align: "right", label: "Time spent (min)", csv: (r) => r.timeSpentMinutes } },
];

function TodayList({ title, tone, items, empty }: { title: string; tone?: "danger" | "brand"; items: TicketRow[]; empty: string }) {
  return (
    <Card>
      <CardHeader title={<span className={cn(tone === "danger" && items.length > 0 && "text-danger")}>{`${title} (${items.length})`}</span>} />
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-fg-muted">{empty}</p>
      ) : (
        <ul className="pb-2">
          {items.map((t) => (
            <li key={t.id} className="relative">
              {tone === "brand" && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />}
              <Link href={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                <PriorityDot priority={t.priority} />
                <span className="font-mono text-[12px] text-fg-muted">{t.ticketNumber}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{t.title}</span>
                <span className="hidden truncate text-[12.5px] text-fg-muted sm:block">{t.requester}</span>
                <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MyToday({ rows }: { rows: TicketRow[] }) {
  const t = today().getTime();
  const open = rows.filter((r) => !isDone(r));
  const overdue = open.filter((r) => r.overdue);
  const dueToday = open.filter((r) => !r.overdue && r.dueDate && istDateOf(new Date(r.dueDate)).getTime() === t);
  const urgent = open.filter((r) => !overdue.includes(r) && !dueToday.includes(r) && (r.priority === "CRITICAL" || r.priority === "HIGH"));
  const waiting = open.filter((r) => (r.status === "WAITING_ON_USER" || r.status === "WAITING_ON_VENDOR") && !overdue.includes(r));
  const resolvedToday = rows.filter((r) => r.resolvedAt && istDateOf(new Date(r.resolvedAt)).getTime() === t);
  const newToday = rows.filter((r) => istDateOf(new Date(r.createdAt)).getTime() === t);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} />
        <StatCard label="Overdue" value={<span className={cn(overdue.length > 0 && "text-danger")}>{overdue.length}</span>} />
        <StatCard label="New today" value={newToday.length} />
        <StatCard label="Resolved today" value={resolvedToday.length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TodayList title="Overdue" tone="danger" items={overdue} empty="Nothing overdue." />
        <TodayList title="Due today" tone="brand" items={dueToday} empty="Nothing else due today." />
        <TodayList title="High & critical" items={urgent} empty="No urgent tickets." />
        <TodayList title="Waiting on someone" items={waiting} empty="Nothing waiting." />
      </div>
    </div>
  );
}

function RankList({ items, empty }: { items: { key: string; label: ReactNode; value: number; sub?: string }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-[13px] text-fg-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-fg-secondary">{i.label}</span>
            <span className="shrink-0 text-fg tabular">
              {i.value}
              {i.sub && <span className="text-fg-muted"> · {i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-subtle">
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const hours = (h: number | null) => (h === null ? "—" : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);

function Insights({ m }: { m: TicketMetrics }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tickets · 12 months" value={m.total} sub={`${m.resolvedCount} resolved`} />
        <StatCard label="Avg. resolution time" value={hours(m.avgResolutionHours)} sub="Opened → resolved" />
        <StatCard label="Median resolution" value={hours(m.medianResolutionHours)} sub="Half are faster than this" />
        <StatCard label="Time logged" value={formatMinutes(m.totalMinutes)} />
      </div>
      <Card>
        <CardHeader title="Tickets per month" description="Opened vs resolved, last 12 months" />
        <CardBody>
          <TicketsPerMonthChart data={m.months} />
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top categories" />
          <CardBody>
            <RankList items={m.topCategories.map((c) => ({ key: c.name, label: c.name, value: c.count }))} empty="No tickets yet." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top requesters" />
          <CardBody>
            <RankList
              items={m.topRequesters.map((r) => ({ key: r.id, label: <Link href={`/employees/${r.id}`} className="hover:underline">{r.name}</Link>, value: r.count }))}
              empty="No tickets yet."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Most problematic assets" description="Tickets + repairs" />
          <CardBody>
            <RankList
              items={m.problemAssets.map((a) => ({
                key: a.id,
                label: <Link href={`/assets/${a.id}`} className="hover:underline">{a.label}</Link>,
                value: a.score,
                sub: `${a.tickets}T · ${a.repairs}R`,
              }))}
              empty="No asset-linked tickets or repairs."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function TicketsView({ rows, metrics, canWrite }: { rows: TicketRow[]; metrics: TicketMetrics; canWrite: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (VIEWS.some((v) => v.key === params.get("view")) ? params.get("view") : "board") as View;
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");

  const boardRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) => (!priority || r.priority === priority) && (!s || [r.ticketNumber, r.title, r.requester, r.category, r.asset].some((v) => v?.toLowerCase().includes(s))),
    );
  }, [rows, q, priority]);
  const open = rows.filter((r) => !isDone(r));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tickets"
        description={`${open.length} open · ${open.filter((r) => r.overdue).length} overdue. Press N anywhere to log a new one.`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => openQuickTicket()}>
              <Plus />
              New ticket
              <kbd className="ml-1 rounded border border-action-fg/30 px-1 font-sans text-[11px] text-action-fg/80">N</kbd>
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 rounded-md border border-line bg-surface p-0.5 text-[13px]" aria-label="Ticket views">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              onClick={() => router.replace(v.key === "board" ? pathname : `${pathname}?view=${v.key}`, { scroll: false })}
              className={cn("flex items-center gap-1.5 rounded px-3 py-1 font-medium text-fg-muted hover:text-fg", view === v.key && "bg-subtle text-fg")}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </nav>
        {view === "board" && (
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards…" aria-label="Filter tickets" className="h-8 bg-surface pl-9" />
            </div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Priority"
              className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-fg"
            >
              <option value="">All priorities</option>
              {Object.entries(TICKET_PRIORITY).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {rows.length === 0 && view !== "insights" ? (
        <Card>
          <EmptyState
            icon={Ticket}
            title="No tickets yet"
            description="Log walk-ins, calls and WhatsApp requests here so your work is tracked."
            action={canWrite && <Button variant="primary" onClick={() => openQuickTicket()}>New ticket</Button>}
          />
        </Card>
      ) : view === "board" ? (
        <TicketBoard rows={boardRows} canWrite={canWrite} />
      ) : view === "table" ? (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search number, title, requester, asset…"
          exportName="tickets"
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/tickets/${r.id}`)}
          initialSorting={[{ id: "ticketNumber", desc: true }]}
          initialHidden={{ source: false, resolvedAt: false, timeSpentMinutes: false, priority: false }}
          pageSize={50}
          filters={[
            { columnId: "status", label: "Status", options: toOptions(TICKET_STATUS) },
            { columnId: "priority", label: "Priority", options: toOptions(TICKET_PRIORITY) },
            { columnId: "category", label: "Category", options: [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))].sort().map((c) => ({ value: c, label: c })) },
            { columnId: "source", label: "Source", options: toOptions(TICKET_SOURCE) },
          ]}
        />
      ) : view === "today" ? (
        <MyToday rows={rows} />
      ) : (
        <Insights m={metrics} />
      )}
    </div>
  );
}
