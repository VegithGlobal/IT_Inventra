"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Blocks, KeySquare, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CsvImport } from "@/components/csv-import";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { formatDate } from "@/lib/format";
import { ACCOUNT_STATUS, EMPLOYEE_STATUS, SYSTEM_CATEGORY, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import { AddAccountButton, CloseAccountsButton } from "./account-ui";
import { importAccounts } from "./actions";
import type { AccountLookups, AccountRow, OpenLeaver } from "./queries";
import { ACCOUNT_CSV_HEADERS } from "./schema";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function AccountStatusBadge({ status }: { status: AccountRow["status"] }) {
  return (
    <Badge tone={ACCOUNT_STATUS[status].tone} dot={status === "ACTIVE"}>
      {ACCOUNT_STATUS[status].label}
    </Badge>
  );
}

export function MfaLabel({ on }: { on: boolean }) {
  return on ? <span className="text-fg-secondary">On</span> : <span className="font-medium text-warning">Off</span>;
}

const columns: ColumnDef<AccountRow, unknown>[] = [
  {
    accessorKey: "employee",
    header: "Employee",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-56">
        <p className="truncate font-medium">{row.original.employee}</p>
        <p className="flex items-center gap-1.5 truncate text-[12.5px] text-fg-muted">
          <span className="font-mono">{row.original.employeeCode}</span>
          {row.original.employeeStatus !== "ACTIVE" && (
            <Badge tone={EMPLOYEE_STATUS[row.original.employeeStatus].tone}>{EMPLOYEE_STATUS[row.original.employeeStatus].label}</Badge>
          )}
        </p>
      </div>
    ),
    meta: { csv: (r) => r.employee },
  },
  { accessorKey: "employeeCode", header: "Employee ID", meta: { csv: (r) => r.employeeCode } },
  {
    accessorKey: "system",
    header: "System",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-56">
        <p className="truncate font-medium">{row.original.system}</p>
        <p className="truncate text-[12.5px] text-fg-muted">{SYSTEM_CATEGORY[row.original.category]}</p>
      </div>
    ),
    meta: { csv: (r) => r.system },
  },
  {
    accessorKey: "username",
    header: "Login ID",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[12.5px] break-all">{row.original.username}</span>
        {row.original.personal && <Badge>Personal</Badge>}
      </span>
    ),
    meta: { csv: (r) => r.username },
  },
  { accessorKey: "accessLevel", header: "Access", cell: ({ getValue }) => (getValue() as string | null) ?? "—", meta: { csv: (r) => r.accessLevel } },
  { accessorKey: "mfaEnabled", header: "2FA", cell: ({ row }) => <MfaLabel on={row.original.mfaEnabled} />, meta: { csv: (r) => (r.mfaEnabled ? "yes" : "no") } },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <AccountStatusBadge status={row.original.status} />, meta: { csv: (r) => ACCOUNT_STATUS[r.status].label } },
  { accessorKey: "grantedAt", header: "Given on", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.grantedAt), meta: { csv: (r) => iso(r.grantedAt) } },
  { accessorKey: "closedAt", header: "Closed on", sortingFn: "datetime", cell: ({ row }) => formatDate(row.original.closedAt), meta: { csv: (r) => iso(r.closedAt) } },
  { accessorKey: "department", header: "Department", cell: ({ getValue }) => (getValue() as string | null) ?? "—", meta: { csv: (r) => r.department } },
  { id: "category", accessorFn: (r) => r.category, header: "Category", cell: ({ row }) => SYSTEM_CATEGORY[row.original.category], meta: { csv: (r) => SYSTEM_CATEGORY[r.category] } },
  { id: "employeeStatus", accessorFn: (r) => r.employeeStatus, header: "Employee status", cell: ({ row }) => EMPLOYEE_STATUS[row.original.employeeStatus].label, meta: { csv: (r) => r.employeeStatus } },
];

export function LeaversCallout({ leavers }: { leavers: OpenLeaver[] }) {
  if (!leavers.length) return null;
  return (
    <Card className="border-danger/25 bg-danger-soft/50">
      <div className="flex items-start gap-3 px-5 pt-5">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div>
          <h2 className="text-[15px] font-semibold text-fg">
            {leavers.length === 1 ? "1 leaver still has" : `${leavers.length} leavers still have`} active logins
          </h2>
          <p className="text-[13px] text-fg-secondary">Block these in each system, then mark them closed from the employee&apos;s page.</p>
        </div>
      </div>
      <ul className="mt-3 border-t border-danger/15">
        {leavers.map((l) => (
          <li key={l.id} className="flex items-center gap-4 border-b border-danger/15 px-5 py-3 last:border-0">
            <Link href={`/employees/${l.id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:underline">
              {l.name}
            </Link>
            <span className="hidden text-[12.5px] text-fg-muted sm:inline">
              {EMPLOYEE_STATUS[l.status].label}
              {l.exitDate && ` · last day ${formatDate(l.exitDate)}`}
            </span>
            <span className="text-[13px] font-medium text-danger tabular">{l.open} to block</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AccountsView({ rows, leavers, lookups, canWrite }: { rows: AccountRow[]; leavers: OpenLeaver[]; lookups: AccountLookups; canWrite: boolean }) {
  const router = useRouter();
  const active = rows.filter((r) => r.status === "ACTIVE");
  const people = new Set(active.map((r) => r.employeeId)).size;
  const noMfa = active.filter((r) => !r.mfaEnabled && !r.personal).length;
  const leaverLogins = leavers.reduce((s, l) => s + l.open, 0);
  const systems = [...new Set(rows.map((r) => r.system))].sort().map((s) => ({ value: s, label: s }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts & logins"
        description="Every login each employee has, so you know exactly what to block when they leave."
        actions={
          <>
            <Button size="sm" asChild>
              <Link href="/accounts/systems">
                <Blocks />
                Systems
              </Link>
            </Button>
            {canWrite && (
              <>
                <CsvImport
                  entity="Login"
                  headers={ACCOUNT_CSV_HEADERS}
                  example={["NW1002", "Google Workspace", "ravi.kumar@company.in", "User", "yes", "no", "2026-01-15", "Recovery phone on file"]}
                  action={importAccounts}
                />
                <AddAccountButton lookups={lookups} />
              </>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active logins" value={active.length} sub={`${rows.length - active.length} closed`} />
        <StatCard label="People with access" value={people} sub={`Across ${new Set(active.map((r) => r.systemId)).size} systems`} />
        <StatCard
          label="Leavers' open logins"
          value={<span className={cn(leaverLogins > 0 && "text-danger")}>{leaverLogins}</span>}
          sub={leaverLogins ? `${leavers.length} employee(s) to finish` : "Nothing to block"}
        />
        <StatCard label="Without 2FA" value={<span className={cn(noMfa > 0 && "text-warning")}>{noMfa}</span>} sub="Active company logins" />
      </div>
      <LeaversCallout leavers={leavers} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search employee, system, login ID…"
        exportName="accounts"
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/accounts/${r.id}`)}
        initialHidden={{ employeeCode: false, closedAt: false, department: false, category: false, employeeStatus: false }}
        filters={[
          { columnId: "status", label: "Status", options: toOptions(ACCOUNT_STATUS) },
          { columnId: "system", label: "System", options: systems },
          { columnId: "category", label: "Category", options: toOptions(SYSTEM_CATEGORY) },
          { columnId: "employeeStatus", label: "Employee", options: toOptions(EMPLOYEE_STATUS) },
        ]}
        bulkActions={
          canWrite
            ? (selected, clear) => {
                const ids = selected.filter((r) => r.status === "ACTIVE").map((r) => r.id);
                return <CloseAccountsButton ids={ids} label={ids.length ? `Close ${ids.length} active` : "None active"} onDone={clear} />;
              }
            : undefined
        }
        empty={
          <EmptyState
            icon={KeySquare}
            title="No logins recorded yet"
            description="Add each employee's email, Google, software and VPN logins. When someone leaves, this becomes their block-list."
            action={canWrite && <AddAccountButton lookups={lookups} label="Record first login" />}
          />
        }
      />
    </div>
  );
}
