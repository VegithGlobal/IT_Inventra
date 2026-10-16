"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, Archive, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { FormError, InputField, SelectField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlideOver } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, todayInput, today } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { archiveReminder, runRemindersNow, saveReminder, setReminderActive } from "./actions";
import type { ReminderLinkOptions, ReminderRow, UpcomingItem } from "./queries";
import { reminderSchema, type ReminderInput } from "./schema";

const REPEAT_LABEL: Record<ReminderInput["repeatRule"], string> = {
  NONE: "Does not repeat",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Every 6 months",
  YEARLY: "Yearly",
  CUSTOM_DAYS: "Every N days",
};
const TYPE_LABEL: Record<ReminderInput["type"], string> = {
  CUSTOM: "Reminder",
  RECURRING_TASK: "Recurring task",
  PREVENTIVE_MAINTENANCE: "Preventive maintenance",
};
const KIND_TONE: Record<string, "brand" | "warning" | "info" | "neutral"> = {
  Payment: "brand",
  Warranty: "warning",
  License: "warning",
  Return: "info",
  Ticket: "info",
  Reminder: "neutral",
};

const emptyReminder = (): ReminderInput => ({
  title: "",
  type: "CUSTOM",
  date: todayInput(),
  time: "09:00",
  repeatRule: "NONE",
  repeatEveryDays: "",
  notes: "",
  assetId: "",
  subscriptionId: "",
  active: true,
});

function ReminderForm({ id, initial, links, onDone }: { id?: string; initial: ReminderInput; links: ReminderLinkOptions; onDone: () => void }) {
  const { form, submit, pending, errors, formError } = useActionForm(reminderSchema, (data) => saveReminder({ id, data }), {
    defaultValues: initial,
    successMessage: id ? "Reminder updated" : "Reminder created",
    onSuccess: onDone,
  });
  const r = form.register;
  const [repeat, type] = useWatch({ control: form.control, name: ["repeatRule", "type"] });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Title" required className="sm:col-span-2" placeholder="Check NAS backup logs" error={errors.title?.message} {...r("title")} />
        <SelectField
          label="Kind"
          options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          hint={type === "RECURRING_TASK" ? "Phase 6 will also open a ticket automatically" : undefined}
          {...r("type")}
        />
        <SelectField label="Repeats" options={Object.entries(REPEAT_LABEL).map(([value, label]) => ({ value, label }))} {...r("repeatRule")} />
        <InputField label="Date" type="date" required error={errors.date?.message} {...r("date")} />
        <InputField label="Time (IST)" type="time" required error={errors.time?.message} {...r("time")} />
        {repeat === "CUSTOM_DAYS" && <InputField label="Every (days)" inputMode="numeric" required error={errors.repeatEveryDays?.message} {...r("repeatEveryDays")} />}
        <SelectField label="Asset" placeholder="—" required={type === "PREVENTIVE_MAINTENANCE"} options={links.assets} error={errors.assetId?.message} {...r("assetId")} />
        <SelectField label="Subscription" placeholder="—" options={links.subscriptions} {...r("subscriptionId")} />
      </FormGrid>
      <TextareaField label="Notes" rows={3} placeholder="Shown in the notification and email" error={errors.notes?.message} {...r("notes")} />
      <label className="flex items-center gap-2 text-[13.5px] text-fg">
        <input type="checkbox" className="size-4 accent-[var(--action)]" {...r("active")} />
        Active
      </label>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create reminder"}
        </Button>
      </div>
    </form>
  );
}

function Timeline({ items }: { items: UpcomingItem[] }) {
  const t = today();
  const groups = new Map<string, UpcomingItem[]>();
  for (const i of items) {
    const label = i.overdue ? "Overdue" : i.date.getTime() === t.getTime() ? "Today" : i.date.getTime() === addDays(t, 1).getTime() ? "Tomorrow" : formatDate(i.date);
    groups.set(label, [...(groups.get(label) ?? []), i]);
  }
  if (!items.length) return <EmptyState icon={AlarmClock} title="Nothing coming up" description="No renewals, expiries or reminders in the next 30 days." />;
  return (
    <Card className="divide-y divide-line">
      {[...groups.entries()].map(([label, list]) => (
        <div key={label} className="grid gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
          <p className={cn("text-[13px] font-medium", label === "Overdue" ? "text-danger" : "text-fg-secondary")}>{label}</p>
          <ul className="flex flex-col gap-2">
            {list.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-subtle">
                  <Badge tone={i.overdue ? "danger" : KIND_TONE[i.kind] ?? "neutral"}>{i.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{i.title}</span>
                  <span className="hidden max-w-[45%] truncate text-[12.5px] text-fg-muted sm:block">{i.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

export function RemindersView({
  rows,
  upcoming,
  links,
  stats,
  canWrite,
}: {
  rows: ReminderRow[];
  upcoming: UpcomingItem[];
  links: ReminderLinkOptions;
  stats: { lastDay: number; emailedLastDay: number; emailOn: boolean };
  canWrite: boolean;
}) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<ReminderRow | null>(null);
  const { pending, run } = useActionRunner();
  const overdue = upcoming.filter((u) => u.overdue).length;
  const week = upcoming.filter((u) => !u.overdue && u.date.getTime() <= addDays(today(), 7).getTime()).length;

  const columns = useMemo<ColumnDef<ReminderRow, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Reminder",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-96">
            <p className={cn("truncate font-medium", !row.original.active && "text-fg-muted")}>{row.original.title}</p>
            <p className="truncate text-[12.5px] text-fg-muted">
              {row.original.link ? (
                <Link href={row.original.link.href} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {row.original.link.label}
                </Link>
              ) : (
                row.original.notes ?? "—"
              )}
            </p>
          </div>
        ),
        meta: { csv: (r) => r.title },
      },
      { accessorKey: "type", header: "Kind", cell: ({ row }) => TYPE_LABEL[row.original.type], meta: { csv: (r) => TYPE_LABEL[r.type] } },
      {
        accessorKey: "nextRunAt",
        header: "Next",
        sortingFn: "datetime",
        cell: ({ row }) => <span className="whitespace-nowrap tabular">{row.original.active ? formatDateTime(row.original.nextRunAt) : "—"}</span>,
        meta: { csv: (r) => new Date(r.nextRunAt).toISOString() },
      },
      {
        accessorKey: "repeatRule",
        header: "Repeats",
        cell: ({ row }) => (row.original.repeatRule === "CUSTOM_DAYS" ? `Every ${row.original.repeatEveryDays} days` : REPEAT_LABEL[row.original.repeatRule]),
        meta: { csv: (r) => r.repeatRule },
      },
      { accessorKey: "lastTriggeredAt", header: "Last sent", sortingFn: "datetime", cell: ({ row }) => formatDateTime(row.original.lastTriggeredAt), meta: { csv: (r) => (r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toISOString() : "") } },
      {
        id: "state",
        accessorFn: (r) => (r.active ? "Active" : "Paused"),
        header: "Status",
        cell: ({ row }) => <Badge tone={row.original.active ? "success" : "neutral"} dot>{row.original.active ? "Active" : row.original.lastTriggeredAt && row.original.repeatRule === "NONE" ? "Done" : "Paused"}</Badge>,
        meta: { csv: (r) => (r.active ? "Active" : "Paused") },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-12" },
        cell: ({ row }) =>
          canWrite && (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
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
                  <MenuItem onSelect={() => run(() => setReminderActive({ id: row.original.id, active: !row.original.active }), row.original.active ? "Paused" : "Resumed")}>
                    {row.original.active ? <Pause /> : <Play />} {row.original.active ? "Pause" : "Resume"}
                  </MenuItem>
                  <MenuItem danger onSelect={() => run(() => archiveReminder({ id: row.original.id }), "Reminder archived")}>
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
  const close = () => {
    setEditing(null);
    if (newOpen) setNewOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reminders"
        description="Automatic reminders for renewals, expiries and returns, plus your own scheduled ones."
        actions={
          canWrite && (
            <>
              <Button
                disabled={pending}
                onClick={() =>
                  run(runRemindersNow, undefined, (s) =>
                    toast.success(`Reminder job ran: ${s.created} new notification(s)${s.emailSkipped ? ` · email off (${s.emailSkipped})` : ` · ${s.emailed} emailed`}`),
                  )
                }
              >
                <RefreshCw className={cn(pending && "animate-spin")} />
                {pending ? "Running…" : "Run now"}
              </Button>
              <Button variant="primary" onClick={() => setNewOpen(true)}>
                <Plus />
                New reminder
              </Button>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overdue" value={<span className={cn(overdue > 0 && "text-danger")}>{overdue}</span>} sub="Payments, returns, tickets…" />
        <StatCard label="Next 7 days" value={week} />
        <StatCard label="Custom reminders" value={rows.filter((r) => r.active).length} sub={`${rows.length} total`} />
        <StatCard
          label="Last 24 hours"
          value={stats.lastDay}
          sub={stats.emailOn ? `${stats.emailedLastDay} sent by email` : <Link href="/settings/notifications" className="hover:underline">Email is off — set up SMTP</Link>}
        />
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Coming up · 30 days ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="custom">My reminders ({rows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <Timeline items={upcoming} />
        </TabsContent>
        <TabsContent value="custom">
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder="Search reminders…"
            exportName="reminders"
            getRowId={(r) => r.id}
            onRowClick={canWrite ? (r) => setEditing(r) : undefined}
            initialHidden={{ lastTriggeredAt: false }}
            filters={[{ columnId: "type", label: "Kind", options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })) }]}
            empty={
              <EmptyState
                icon={AlarmClock}
                title="No custom reminders"
                description="Schedule one-off or repeating reminders, like a monthly backup check or quarterly printer servicing."
                action={canWrite && <Button variant="primary" onClick={() => setNewOpen(true)}>New reminder</Button>}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <SlideOver open={formOpen} onOpenChange={(o) => !o && close()} title={editing ? "Edit reminder" : "New reminder"}>
        {formOpen && <ReminderForm key={editing?.id ?? "new"} id={editing?.id} initial={editing?.form ?? emptyReminder()} links={links} onDone={close} />}
      </SlideOver>
    </div>
  );
}
