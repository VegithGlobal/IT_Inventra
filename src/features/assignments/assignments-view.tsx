"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, FileText, LogIn, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssignDialog, CheckInDialog, TransferDialog } from "./dialogs";
import type { AssignOptions, AssignmentRow } from "./queries";

type Dialog = { kind: "checkin" | "transfer"; row: AssignmentRow } | null;
const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function AssignmentsView({ rows, options, canWrite }: { rows: AssignmentRow[]; options: AssignOptions; canWrite: boolean }) {
  const [assignOpen, setAssignOpen] = useQueryFlag("assign");
  const [scope, setScope] = useState<"current" | "all">("current");
  const [dialog, setDialog] = useState<Dialog>(null);

  const current = rows.filter((r) => r.state !== "RETURNED");
  const overdue = current.filter((r) => r.state === "OVERDUE").length;
  const data = scope === "current" ? current : rows;

  const columns = useMemo<ColumnDef<AssignmentRow, unknown>[]>(
    () => [
      {
        accessorKey: "assetTag",
        header: "Asset",
        cell: ({ row }) => (
          <Link href={`/assets/${row.original.assetId}`} className="group/link min-w-0" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-[12.5px] font-medium group-hover/link:underline">{row.original.assetTag}</span>
            <span className="block max-w-64 truncate text-[12.5px] text-fg-muted">{row.original.assetName}</span>
          </Link>
        ),
        meta: { csv: (r) => r.assetTag },
      },
      { accessorKey: "assetName", header: "Asset name", meta: { csv: (r) => r.assetName } },
      { accessorKey: "assetType", header: "Type", meta: { csv: (r) => r.assetType } },
      {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) => (
          <Link href={`/employees/${row.original.employeeId}`} className="flex items-center gap-2 hover:underline">
            <Avatar name={row.original.employee} size="xs" />
            <span className="truncate">{row.original.employee}</span>
            {row.original.employeeStatus !== "ACTIVE" && <Badge tone={row.original.employeeStatus === "LEAVING" ? "warning" : "neutral"}>{row.original.employeeStatus === "LEAVING" ? "Leaving" : "Exited"}</Badge>}
          </Link>
        ),
        meta: { csv: (r) => r.employee },
      },
      { accessorKey: "department", header: "Department", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.department } },
      { accessorKey: "issuedAt", header: "Issued", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.issuedAt), meta: { csv: (r) => iso(r.issuedAt) } },
      {
        accessorKey: "expectedReturnAt",
        header: "Expected return",
        sortingFn: "datetime",
        cell: ({ row }) => <span className={cn(row.original.state === "OVERDUE" && "text-danger")}>{formatDate(row.original.expectedReturnAt)}</span>,
        meta: { csv: (r) => iso(r.expectedReturnAt) },
      },
      { accessorKey: "returnedAt", header: "Returned", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.returnedAt), meta: { csv: (r) => iso(r.returnedAt) } },
      { accessorKey: "days", header: "Days", meta: { align: "right", csv: (r) => r.days } },
      {
        accessorKey: "state",
        header: "State",
        cell: ({ row }) =>
          row.original.state === "OVERDUE" ? (
            <Badge tone="danger" dot>Overdue</Badge>
          ) : row.original.state === "ACTIVE" ? (
            <Badge tone="success" dot>With employee</Badge>
          ) : (
            <Badge>Returned</Badge>
          ),
        meta: { csv: (r) => r.state },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-12" },
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Row actions" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {canWrite && row.original.state !== "RETURNED" && (
                  <>
                    <MenuItem onSelect={() => setDialog({ kind: "checkin", row: row.original })}>
                      <LogIn /> Check in
                    </MenuItem>
                    <MenuItem onSelect={() => setDialog({ kind: "transfer", row: row.original })}>
                      <ArrowLeftRight /> Transfer
                    </MenuItem>
                  </>
                )}
                <MenuItem asChild>
                  <Link href={`/print/handover/${row.original.id}`} target="_blank">
                    <FileText /> Handover form
                  </Link>
                </MenuItem>
                {row.original.returnedAt && (
                  <MenuItem asChild>
                    <Link href={`/print/return/${row.original.id}`} target="_blank">
                      <FileText /> Return form
                    </Link>
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
        ),
      },
    ],
    [canWrite],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assignments"
        description="Every check-out and check-in, kept as permanent history."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setAssignOpen(true)}>
              <Plus />
              Assign asset
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Currently assigned" value={current.length} />
        <StatCard label="Overdue returns" value={<span className={cn(overdue > 0 && "text-danger")}>{overdue}</span>} />
        <StatCard label="Available to assign" value={options.assets.filter((a) => a.status === "IN_STOCK").length} />
        <StatCard label="All-time assignments" value={rows.length} />
      </div>
      <div className="flex gap-1 self-start rounded-md border border-line bg-surface p-0.5 text-[13px]" role="group" aria-label="Scope">
        {(
          [
            ["current", "Current"],
            ["all", "Full history"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={scope === key}
            onClick={() => setScope(key)}
            className={cn("rounded px-3 py-1 font-medium text-fg-muted", scope === key && "bg-subtle text-fg")}
          >
            {label}
          </button>
        ))}
      </div>
      <DataTable
        key={scope}
        data={data}
        columns={columns}
        searchPlaceholder="Search asset, employee…"
        exportName={scope === "current" ? "current-assignments" : "assignment-history"}
        getRowId={(r) => r.id}
        initialHidden={{ assetName: false, assetType: false, returnedAt: scope === "current", department: true }}
        initialSorting={[{ id: "issuedAt", desc: true }]}
        filters={[
          {
            columnId: "state",
            label: "State",
            options: [
              { value: "ACTIVE", label: "With employee" },
              { value: "OVERDUE", label: "Overdue" },
              ...(scope === "all" ? [{ value: "RETURNED", label: "Returned" }] : []),
            ],
          },
        ]}
        empty={
          <EmptyState
            icon={ArrowLeftRight}
            title={scope === "current" ? "Nothing is checked out" : "No assignments yet"}
            description="Assign an in-stock asset to an employee to start its history."
            action={canWrite && <Button variant="primary" onClick={() => setAssignOpen(true)}>Assign asset</Button>}
          />
        }
      />
      <AssignDialog open={assignOpen && canWrite} onOpenChange={setAssignOpen} options={options} />
      {dialog?.kind === "checkin" && (
        <CheckInDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          assignmentId={dialog.row.id}
          label={`${dialog.row.assetTag} from ${dialog.row.employee}`}
          defaultCondition={dialog.row.conditionAtIssue}
        />
      )}
      {dialog?.kind === "transfer" && (
        <TransferDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          assetId={dialog.row.assetId}
          label={`${dialog.row.assetTag} · currently with ${dialog.row.employee}`}
          employees={options.employees}
          currentEmployeeId={dialog.row.employeeId}
        />
      )}
    </div>
  );
}
