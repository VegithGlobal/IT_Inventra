"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ArchiveRestore, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CsvImport } from "@/components/csv-import";
import { DataTable } from "@/components/data-table/data-table";
import { useActionRunner } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, SlideOver } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { EMPLOYEE_STATUS, toOptions } from "@/lib/options";
import { archiveEmployees, deleteEmployees, importEmployees, restoreEmployees } from "./actions";
import { EmployeeForm } from "./employee-form";
import type { EmployeeRow, Lookups } from "./queries";
import { EMPLOYEE_CSV_HEADERS } from "./schema";

const columns: ColumnDef<EmployeeRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.original.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-[12.5px] text-fg-muted">{row.original.designation ?? "—"}</p>
        </div>
      </div>
    ),
    meta: { csv: (r) => r.name },
  },
  {
    accessorKey: "employeeCode",
    header: "Employee ID",
    cell: ({ getValue }) => <span className="font-mono text-[12.5px] text-fg-secondary">{String(getValue())}</span>,
    sortingFn: "alphanumeric",
    meta: { csv: (r) => r.employeeCode },
  },
  {
    accessorKey: "companyCode",
    header: "Company",
    cell: ({ getValue }) => <span className="font-mono text-[12.5px] font-medium">{String(getValue())}</span>,
    meta: { csv: (r) => r.companyCode },
  },
  { accessorKey: "department", header: "Department", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.department } },
  { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue() ?? "—", meta: { csv: (r) => r.location } },
  { accessorKey: "email", header: "Email", cell: ({ getValue }) => <span className="text-fg-secondary">{String(getValue() ?? "—")}</span>, meta: { csv: (r) => r.email } },
  {
    accessorKey: "assetCount",
    header: "Assets",
    cell: ({ row }) =>
      row.original.assetCount ? (
        <span className="tabular">
          {row.original.assetCount} <span className="text-fg-muted">· {formatMoney(row.original.assetValue)}</span>
        </span>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
    meta: { csv: (r) => r.assetCount, label: "Assets held" },
  },
  {
    accessorKey: "joiningDate",
    header: "Joined",
    cell: ({ row }) => <span className="tabular">{formatDate(row.original.joiningDate)}</span>,
    sortingFn: "datetime",
    meta: { csv: (r) => (r.joiningDate ? new Date(r.joiningDate).toISOString().slice(0, 10) : "") },
  },
];

/** "2 assets · 1 login" still to collect, or "" once handover is done. */
function pendingLabel(p: EmployeeRow["pending"]) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [p.assets && plural(p.assets, "asset"), p.seats && plural(p.seats, "license seat"), p.logins && plural(p.logins, "login")].filter(Boolean).join(" · ");
}

const currentColumns: ColumnDef<EmployeeRow, unknown>[] = [
  ...columns,
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge tone={EMPLOYEE_STATUS[row.original.status].tone} dot>
        {EMPLOYEE_STATUS[row.original.status].label}
      </Badge>
    ),
    meta: { csv: (r) => r.status },
  },
];

const archivedColumns: ColumnDef<EmployeeRow, unknown>[] = [
  ...columns.filter((c) => !("accessorKey" in c) || c.accessorKey !== "joiningDate"),
  {
    accessorKey: "exitDate",
    header: "Left",
    cell: ({ row }) => <span className="tabular">{formatDate(row.original.exitDate)}</span>,
    sortingFn: "datetime",
    meta: { csv: (r) => (r.exitDate ? new Date(r.exitDate).toISOString().slice(0, 10) : "") },
  },
  {
    id: "handover",
    accessorFn: (r) => (pendingLabel(r.pending) ? "PENDING" : "DONE"),
    header: "Handover",
    cell: ({ row }) => {
      const left = pendingLabel(row.original.pending);
      return left ? (
        <Badge tone="warning" dot>
          {left} left
        </Badge>
      ) : (
        <Badge tone="success" dot>
          Done
        </Badge>
      );
    },
    meta: { csv: (r) => pendingLabel(r.pending) || "Done", label: "Handover" },
  },
];

type Confirm = { kind: "archive" | "restore" | "delete"; rows: EmployeeRow[]; clear: () => void };

export function EmployeesView({
  view,
  rows: allRows,
  lookups,
  canWrite,
  canDelete,
}: {
  view: "current" | "archived";
  rows: EmployeeRow[];
  lookups: Lookups;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const { pending, run } = useActionRunner();
  const archived = view === "archived";
  const current = allRows.filter((r) => !r.archivedAt);
  const rows = archived ? allRows.filter((r) => r.archivedAt) : current;
  const companyCodes = [...new Set(rows.map((r) => r.companyCode))].sort();

  const count = confirm?.rows.length ?? 0;
  const ids = confirm?.rows.map((r) => r.id) ?? [];
  const who = count === 1 ? confirm?.rows[0].name : `${count} employees`;
  const notDone = confirm?.rows.filter((r) => pendingLabel(r.pending)).length ?? 0;
  const plural = (n: number) => `${n} employee${n === 1 ? "" : "s"}`;
  const finish = (message: string) => {
    confirm?.clear();
    setConfirm(null);
    toast.success(message);
  };
  const copy = {
    archive: {
      title: `Archive ${who}?`,
      body: "Use this when someone leaves. They move to the Archived tab, are marked exited (exit date today if not set) and drop out of pickers. Collect their assets, revoke license seats and close logins, then delete them from the Archived tab.",
      label: "Archive",
      go: () => run(() => archiveEmployees({ ids }), undefined, (r) => finish(`${plural(r.archived)} archived`)),
    },
    restore: {
      title: `Restore ${who}?`,
      body: "Moves them back to the current employees list. Their status stays exited — edit them to make them active again.",
      label: "Restore",
      go: () => run(() => restoreEmployees({ ids }), undefined, (r) => finish(`${plural(r.restored)} restored`)),
    },
    delete: {
      title: `Delete ${who} permanently?`,
      body:
        `Removes ${count === 1 ? "the employee" : "these employees"} with their logins, assignment history, documents and the tickets they raised. Expenses and repairs are kept, and their name stays in each asset's previous users. This can't be undone.` +
        (notDone > 0 ? ` ${notDone} ${notDone === 1 ? "hasn't" : "haven't"} finished handover yet — collect everything first, or the delete will be refused.` : ""),
      label: "Delete permanently",
      go: () => run(() => deleteEmployees({ ids }), undefined, (r) => finish(`${plural(r.deleted)} deleted`)),
    },
  }[confirm?.kind ?? "archive"];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description={archived ? "People who've left. Collect their handover, then delete them." : "Staff who receive assets. They don't sign in to this app."}
        actions={
          canWrite &&
          !archived && (
            <>
              <CsvImport
                entity="Employee"
                headers={EMPLOYEE_CSV_HEADERS}
                example={["NW2001", "Ritika Saxena", "ritika.saxena@company.in", "+91 98000 00000", "Analyst", "Finance", "Pune HQ · Floor 4", "2026-01-15"]}
                action={importEmployees}
              />
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus />
                New employee
              </Button>
            </>
          )
        }
      />
      <LinkTabs
        active={view}
        tabs={[
          { key: "current", label: "Current", href: "/employees", count: current.length },
          { key: "archived", label: "Archived", href: "/employees?view=archived", count: allRows.length - current.length },
        ]}
      />
      <DataTable
        data={rows}
        columns={archived ? archivedColumns : currentColumns}
        searchPlaceholder="Search name, ID, company, email…"
        exportName={archived ? "employees-archived" : "employees"}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/employees/${r.id}`)}
        initialHidden={{ email: false }}
        filters={[
          { columnId: "companyCode", label: "Company", options: companyCodes.map((c) => ({ value: c, label: c })) },
          archived
            ? { columnId: "handover", label: "Handover", options: [{ value: "PENDING", label: "Pending" }, { value: "DONE", label: "Done" }] }
            : { columnId: "status", label: "Status", options: toOptions(EMPLOYEE_STATUS) },
          { columnId: "department", label: "Department", options: lookups.departments.map((d) => ({ value: d.name, label: d.name })) },
          { columnId: "location", label: "Location", options: lookups.locations.map((d) => ({ value: d.name, label: d.name })) },
        ]}
        bulkActions={
          !canWrite
            ? undefined
            : archived
              ? (selected, clear) => (
                  <>
                    <Button size="sm" disabled={pending} onClick={() => setConfirm({ kind: "restore", rows: selected, clear })}>
                      <ArchiveRestore />
                      Restore
                    </Button>
                    {canDelete && (
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirm({ kind: "delete", rows: selected, clear })}>
                        <Trash2 />
                        Delete
                      </Button>
                    )}
                  </>
                )
              : (selected, clear) => (
                  <Button size="sm" disabled={pending} onClick={() => setConfirm({ kind: "archive", rows: selected, clear })}>
                    <Archive />
                    Archive
                  </Button>
                )
        }
        empty={
          archived ? (
            <EmptyState icon={Archive} title="No archived employees" description="When someone leaves, archive them from their page or by selecting them in the Current tab." />
          ) : (
            <EmptyState
              icon={Users}
              title="No employees yet"
              description="Add your team so you can assign assets and log tickets for them."
              action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add employee</Button>}
            />
          )
        }
      />
      <Modal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={copy.title}
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === "delete" ? "danger" : "primary"} disabled={pending} onClick={copy.go}>
              {pending ? "Working…" : copy.label}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-secondary">{copy.body}</p>
      </Modal>
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New employee">
        <EmployeeForm lookups={lookups} onDone={(id) => router.push(`/employees/${id}`)} />
      </SlideOver>
    </div>
  );
}
