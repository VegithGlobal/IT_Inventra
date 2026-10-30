"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, CheckCircle2, CreditCard, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { BILLING_CYCLE, PAYMENT_MODE, SUBSCRIPTION_CATEGORY, SUBSCRIPTION_STATUS, subscriptionCategoryLabel, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { Lookups } from "@/features/employees/queries";
import { DueLabel } from "./due-label";
import { MarkPaidDialog, type PayTarget } from "./mark-paid";
import type { SubscriptionRow } from "./queries";
import { SubscriptionForm } from "./subscription-form";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function SubscriptionsView({ rows, lookups, canWrite }: { rows: SubscriptionRow[]; lookups: Lookups; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = rows.filter((r) => r.status === "ACTIVE");
  const overdue = active.filter((r) => r.daysUntilDue < 0);
  const dueSoon = active.filter((r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7);
  const monthly = active.reduce((s, r) => s + r.monthly, 0);
  const due30 = active.filter((r) => r.daysUntilDue <= 30).reduce((s, r) => s + r.amount, 0);
  const data = showInactive ? rows : active;

  const columns = useMemo<ColumnDef<SubscriptionRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Service",
        cell: ({ row }) => (
          <div className="relative min-w-0 max-w-80">
            {row.original.status === "ACTIVE" && row.original.daysUntilDue >= 0 && row.original.daysUntilDue <= 7 && (
              <span className="absolute top-0 bottom-0 -left-4 w-[3px] rounded-full bg-brand" aria-hidden />
            )}
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-[12.5px] text-fg-muted">{row.original.planDetails ?? row.original.accountId ?? "—"}</p>
          </div>
        ),
        meta: { csv: (r) => r.name },
      },
      { accessorKey: "category", header: "Category", cell: ({ row }) => subscriptionCategoryLabel(row.original.category), meta: { csv: (r) => subscriptionCategoryLabel(r.category) } },
      { accessorKey: "vendor", header: "Provider", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.vendor } },
      { accessorKey: "accountId", header: "Account ID", meta: { csv: (r) => r.accountId } },
      {
        accessorKey: "billingCycle",
        header: "Cycle",
        cell: ({ row }) => (row.original.billingCycle === "CUSTOM" ? `Every ${row.original.customCycleDays} days` : BILLING_CYCLE[row.original.billingCycle]),
        meta: { csv: (r) => BILLING_CYCLE[r.billingCycle] },
      },
      {
        accessorKey: "nextDueDate",
        header: "Next due",
        sortingFn: "datetime",
        cell: ({ row }) => <DueLabel date={row.original.nextDueDate} days={row.original.daysUntilDue} inactive={row.original.status !== "ACTIVE"} />,
        meta: { csv: (r) => iso(r.nextDueDate) },
      },
      { accessorKey: "lastPaidAt", header: "Last paid", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.lastPaidAt), meta: { csv: (r) => iso(r.lastPaidAt) } },
      { accessorKey: "paymentMode", header: "Pays by", cell: ({ row }) => (row.original.paymentMode ? PAYMENT_MODE[row.original.paymentMode] : "—"), meta: { csv: (r) => r.paymentMode } },
      { accessorKey: "location", header: "Location", meta: { csv: (r) => r.location } },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Badge tone={SUBSCRIPTION_STATUS[row.original.status].tone} dot>
              {SUBSCRIPTION_STATUS[row.original.status].label}
            </Badge>
            {row.original.autoRenew && <Badge tone="info">Auto</Badge>}
          </span>
        ),
        meta: { csv: (r) => r.status },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => formatMoney(row.original.amount, row.original.currency),
        meta: { align: "right", csv: (r) => r.amount.toFixed(2) },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-28" },
        cell: ({ row }) =>
          canWrite &&
          row.original.status !== "CANCELLED" && (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant={row.original.daysUntilDue <= 7 ? "primary" : "secondary"}
                className={cn(row.original.daysUntilDue > 7 && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
                onClick={() => setPayTarget(row.original)}
              >
                Mark paid
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Row actions" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => router.push(`/subscriptions/${row.original.id}`)}>Open</MenuItem>
                  <MenuItem onSelect={() => router.push(`/subscriptions/${row.original.id}?edit=1`)}>Edit</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ),
      },
    ],
    [canWrite, router],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subscriptions"
        description="WiFi, cloud servers, domains, licences and AMCs — with billing cycles and payment history."
        actions={
          <>
            <Button asChild>
              <Link href="/subscriptions/calendar">
                <CalendarDays />
                Calendar
              </Link>
            </Button>
            {canWrite && (
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus />
                New subscription
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monthly run-rate" value={formatMoneyShort(monthly)} sub={`${formatMoneyShort(monthly * 12)} a year · ${active.length} active`} />
        <StatCard label="Due in 30 days" value={formatMoneyShort(due30)} sub={`${active.filter((r) => r.daysUntilDue <= 30).length} payment(s)`} />
        <StatCard label="Due this week" value={dueSoon.length} sub={dueSoon.slice(0, 2).map((r) => r.name.split(" · ")[0]).join(", ") || "Nothing due"} />
        <StatCard
          label="Overdue"
          value={<span className={cn(overdue.length > 0 && "text-danger")}>{overdue.length}</span>}
          sub={overdue.length ? formatMoney(overdue.reduce((s, r) => s + r.amount, 0)) : "All caught up"}
          trend={overdue.length === 0 ? <CheckCircle2 className="size-5 text-success" aria-label="All paid" /> : null}
        />
      </div>

      <DataTable
        key={String(showInactive)}
        data={data}
        columns={columns}
        searchPlaceholder="Search service, provider, account…"
        exportName="subscriptions"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/subscriptions/${r.id}`)}
        initialSorting={[{ id: "nextDueDate", desc: false }]}
        initialHidden={{ accountId: false, lastPaidAt: false, paymentMode: false, location: false }}
        filters={[
          {
            columnId: "category",
            label: "Category",
            options: [...toOptions(SUBSCRIPTION_CATEGORY), ...lookups.subscriptionCategories.filter((c) => !(c in SUBSCRIPTION_CATEGORY)).map((c) => ({ value: c, label: c }))],
          },
          { columnId: "billingCycle", label: "Cycle", options: toOptions(BILLING_CYCLE) },
          ...(showInactive ? [{ columnId: "status", label: "Status", options: toOptions(SUBSCRIPTION_STATUS) }] : []),
        ]}
        toolbar={
          <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
            <input type="checkbox" className="size-4 accent-[var(--action)]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show paused & cancelled
          </label>
        }
        empty={
          <EmptyState
            icon={CreditCard}
            title="No subscriptions yet"
            description="Add your internet lines, cloud servers and software plans to get renewal reminders and payment history."
            action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add subscription</Button>}
          />
        }
      />

      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New subscription">
        <SubscriptionForm lookups={lookups} onDone={(r) => router.push(`/subscriptions/${r.id}`)} />
      </SlideOver>
      <MarkPaidDialog target={payTarget} onOpenChange={(o) => !o && setPayTarget(null)} />
    </div>
  );
}
