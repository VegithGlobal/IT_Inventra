"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { CsvImport } from "@/components/csv-import";
import { DataTable } from "@/components/data-table/data-table";
import { useQueryFlag } from "@/components/use-query-flag";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDate, formatMoney } from "@/lib/format";
import { EMPLOYEE_STATUS, toOptions } from "@/lib/options";
import { importEmployees } from "./actions";
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
    meta: { csv: (r) => r.employeeCode },
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

export function EmployeesView({ rows, lookups, canWrite }: { rows: EmployeeRow[]; lookups: Lookups; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useQueryFlag("new");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Staff who receive assets. They don't sign in to this app."
        actions={
          canWrite && (
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
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search name, ID, email…"
        exportName="employees"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/employees/${r.id}`)}
        initialHidden={{ email: false }}
        filters={[
          { columnId: "status", label: "Status", options: toOptions(EMPLOYEE_STATUS) },
          { columnId: "department", label: "Department", options: lookups.departments.map((d) => ({ value: d.name, label: d.name })) },
          { columnId: "location", label: "Location", options: lookups.locations.map((d) => ({ value: d.name, label: d.name })) },
        ]}
        empty={
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add your team so you can assign assets and log tickets for them."
            action={canWrite && <Button variant="primary" onClick={() => setOpen(true)}>Add employee</Button>}
          />
        }
      />
      <SlideOver open={open && canWrite} onOpenChange={setOpen} title="New employee">
        <EmployeeForm lookups={lookups} onDone={(id) => router.push(`/employees/${id}`)} />
      </SlideOver>
    </div>
  );
}
