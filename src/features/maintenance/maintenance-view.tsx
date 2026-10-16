"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Archive, CalendarClock, MoreHorizontal, Pencil, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useActionRunner } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, SlideOver } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, formatMoney, formatMoneyShort } from "@/lib/format";
import { ASSET_STATUS } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { ReminderLinkOptions } from "@/features/reminders/queries";
import { ReminderForm, emptyReminder } from "@/features/reminders/reminders-view";
import { archiveMaintenance } from "./actions";
import { CloseRepairDialog, RepairForm, emptyRepair } from "./dialogs";
import type { MaintenanceLookups, MaintenanceRow, PreventiveRow } from "./queries";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const REPEAT: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Every 6 months", YEARLY: "Yearly", NONE: "Once" };

export function MaintenanceView({
  rows,
  schedules,
  lookups,
  reminderLinks,
  fySpend,
  canWrite,
}: {
  rows: MaintenanceRow[];
  schedules: PreventiveRow[];
  lookups: MaintenanceLookups;
  reminderLinks: ReminderLinkOptions;
  fySpend: number;
  canWrite: boolean;
}) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<MaintenanceRow | null>(null);
  const [closing, setClosing] = useState<MaintenanceRow | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scope, setScope] = useState<"open" | "all">("open");
  const { run } = useActionRunner();

  const open = rows.filter((r) => r.status === "OPEN");
  const data = scope === "open" ? open : rows;

  const columns = useMemo<ColumnDef<MaintenanceRow, unknown>[]>(
    () => [
      {
        accessorKey: "assetTag",
        header: "Asset",
        cell: ({ row }) => (
          <Link href={`/assets/${row.original.assetId}`} onClick={(e) => e.stopPropagation()} className="block min-w-0 hover:underline">
            <span className="font-mono text-[12.5px] font-medium">{row.original.assetTag}</span>
            <span className="block max-w-56 truncate text-[12.5px] text-fg-muted">{row.original.assetName}</span>
          </Link>
        ),
        meta: { csv: (r) => r.assetTag },
      },
      { accessorKey: "issue", header: "Issue", cell: ({ row }) => <span className="line-clamp-2 max-w-80">{row.original.issue}</span>, meta: { csv: (r) => r.issue } },
      { accessorKey: "vendor", header: "Service centre", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.vendor } },
      { accessorKey: "sentAt", header: "Sent", sortingFn: "datetime", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.sentAt)}</span>, meta: { csv: (r) => iso(r.sentAt) } },
      {
        accessorKey: "expectedReturnAt",
        header: "Expected",
        sortingFn: "datetime",
        cell: ({ row }) => <span className={cn("whitespace-nowrap", row.original.overdue && "font-medium text-danger")}>{formatDate(row.original.expectedReturnAt)}</span>,
        meta: { csv: (r) => iso(r.expectedReturnAt) },
      },
      { accessorKey: "returnedAt", header: "Returned", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.returnedAt), meta: { csv: (r) => iso(r.returnedAt) } },
      { accessorKey: "daysOut", header: "Days", meta: { align: "right", csv: (r) => r.daysOut } },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "OPEN" ? (
            <span className="flex items-center gap-1.5">
              <Badge tone={row.original.overdue ? "danger" : "warning"} dot>
                {row.original.overdue ? "Overdue" : "At repair"}
              </Badge>
              {row.original.underWarranty && <Badge tone="info">Warranty</Badge>}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Badge tone="success" dot>Returned</Badge>
              {row.original.underWarranty && <Badge tone="info">Warranty</Badge>}
            </span>
          ),
        meta: { csv: (r) => (r.status === "OPEN" ? (r.overdue ? "Overdue" : "Open") : "Closed") },
      },
      {
        id: "ticket",
        accessorFn: (r) => r.ticket?.ticketNumber ?? "",
        header: "Ticket",
        cell: ({ row }) =>
          row.original.ticket ? (
            <Link href={`/tickets/${row.original.ticket.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] text-fg-secondary hover:underline">
              {row.original.ticket.ticketNumber}
            </Link>
          ) : (
            "—"
          ),
        meta: { csv: (r) => r.ticket?.ticketNumber ?? "" },
      },
      { accessorKey: "outcome", header: "Outcome", cell: ({ getValue }) => <span className="line-clamp-1 max-w-64 text-fg-secondary">{String(getValue() ?? "—")}</span>, meta: { csv: (r) => r.outcome } },
      { accessorKey: "cost", header: "Cost", cell: ({ row }) => (row.original.cost === null ? "—" : formatMoney(row.original.cost)), meta: { align: "right", csv: (r) => r.cost?.toFixed(2) } },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-32" },
        cell: ({ row }) =>
          canWrite && (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {row.original.status === "OPEN" && (
                <Button size="sm" onClick={() => setClosing(row.original)}>
                  Returned
                </Button>
              )}
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Row actions" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setEditing(row.original)}>
                    <Pencil /> Edit
                  </MenuItem>
                  <MenuItem danger onSelect={() => run(() => archiveMaintenance({ id: row.original.id }), "Repair archived")}>
                    <Archive /> Archive
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ),
      },
    ],
    [canWrite, run],
  );

  const formOpen = (newOpen || !!editing) && canWrite;
  const closeForm = () => {
    setEditing(null);
    if (newOpen) setNewOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Maintenance"
        description="Repairs at service centres and preventive servicing schedules."
        actions={
          canWrite && (
            <>
              <Button onClick={() => setScheduleOpen(true)}>
                <CalendarClock />
                New schedule
              </Button>
              <Button variant="primary" onClick={() => setNewOpen(true)}>
                <Plus />
                Log repair
              </Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="At repair now" value={open.length} />
        <StatCard label="Overdue returns" value={<span className={cn(open.some((r) => r.overdue) && "text-danger")}>{open.filter((r) => r.overdue).length}</span>} />
        <StatCard label="Repair spend · this FY" value={formatMoneyShort(fySpend)} />
        <StatCard label="Under warranty" value={rows.filter((r) => r.underWarranty).length} sub={`of ${rows.length} repairs`} />
      </div>

      <Tabs defaultValue="repairs">
        <TabsList>
          <TabsTrigger value="repairs">Repairs</TabsTrigger>
          <TabsTrigger value="schedules">Preventive schedules ({schedules.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="repairs">
          <div className="mb-4 flex gap-1 self-start rounded-md border border-line bg-surface p-0.5 text-[13px]" role="group" aria-label="Show">
            {(
              [
                ["open", `At repair (${open.length})`],
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
            searchPlaceholder="Search asset, issue, service centre…"
            exportName="repairs"
            getRowId={(r) => r.id}
            onRowClick={canWrite ? (r) => setEditing(r) : undefined}
            initialSorting={[{ id: "sentAt", desc: true }]}
            initialHidden={{ returnedAt: scope === "open", outcome: scope === "open", ticket: true }}
            empty={
              <EmptyState
                icon={Wrench}
                title={scope === "open" ? "Nothing is out for repair" : "No repairs logged"}
                description="Log a repair to mark the asset Under repair and track its cost."
                action={canWrite && <Button variant="primary" onClick={() => setNewOpen(true)}>Log repair</Button>}
              />
            }
          />
        </TabsContent>
        <TabsContent value="schedules">
          {schedules.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarClock} title="No preventive schedules" description="e.g. printer servicing every 3 months or UPS battery checks every 6 months. You'll get a reminder each time." />
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {schedules.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <CalendarClock className="size-4 text-fg-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13.5px] font-medium", !s.active && "text-fg-muted")}>{s.title}</p>
                    {s.asset && (
                      <Link href={`/assets/${s.asset.id}`} className="text-[12.5px] text-fg-muted hover:underline">
                        {s.asset.assetTag} · {s.asset.name}
                      </Link>
                    )}
                  </div>
                  <Badge>{s.repeatRule === "CUSTOM_DAYS" ? `Every ${s.repeatEveryDays} days` : REPEAT[s.repeatRule]}</Badge>
                  <span className="text-[13px] text-fg-secondary tabular">{s.active ? `Next ${formatDateTime(s.nextRunAt)}` : "Paused"}</span>
                </div>
              ))}
              <p className="px-5 py-3 text-[12.5px] text-fg-muted">
                Edit or pause schedules on the{" "}
                <Link href="/reminders" className="underline">
                  Reminders
                </Link>{" "}
                page.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <SlideOver open={formOpen} onOpenChange={(o) => !o && closeForm()} title={editing ? "Edit repair" : "Log repair"} description={editing ? undefined : "The asset is marked Under repair until it's returned."}>
        {formOpen && <RepairForm key={editing?.id ?? "new"} id={editing?.id} initial={editing?.form ?? emptyRepair()} lookups={lookups} onDone={closeForm} />}
      </SlideOver>
      <CloseRepairDialog
        target={
          closing && {
            id: closing.id,
            label: `${closing.assetTag} · ${closing.issue}`,
            cost: closing.cost,
            previousLabel: ASSET_STATUS[closing.previousAssetStatus === "UNDER_REPAIR" || !closing.previousAssetStatus ? "IN_STOCK" : closing.previousAssetStatus].label.toLowerCase(),
          }
        }
        onOpenChange={(o) => !o && setClosing(null)}
      />
      <Modal open={scheduleOpen} onOpenChange={setScheduleOpen} title="New preventive schedule" description="A repeating reminder to service an asset." size="lg">
        {scheduleOpen && (
          <ReminderForm initial={emptyReminder({ type: "PREVENTIVE_MAINTENANCE", repeatRule: "QUARTERLY", title: "Service " })} links={reminderLinks} onDone={() => setScheduleOpen(false)} />
        )}
      </Modal>
    </div>
  );
}
