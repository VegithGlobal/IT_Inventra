import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimpleTable } from "@/components/simple-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PriorityDot } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageSkeleton, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAssignOptions } from "@/features/assignments/queries";
import { EmployeeActions, QuickReturnButton } from "@/features/employees/employee-actions";
import { RevokeSeatButton } from "@/features/licenses/license-ui";
import { getEmployee, getLookups } from "@/features/employees/queries";
import { daysBetween, toDateInput, today } from "@/lib/dates";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { ASSET_CONDITION, ASSET_STATUS, EMPLOYEE_STATUS, TICKET_STATUS } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Employee" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, e] = await Promise.all([requireUser(), getEmployee(id)]);
  if (!e) notFound();
  const writable = canWrite(user.role);
  const [lookups, assignOptions] = writable ? await Promise.all([getLookups(), getAssignOptions()]) : [null, null];

  const open = e.assignments.filter((a) => !a.returnedAt);
  const heldValue = e.heldAssets.reduce((s, a) => s + toNumber(a.purchaseCost), 0);
  const offboarding = e.status !== "ACTIVE" && (open.length > 0 || e.licenseSeats.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={e.name} size="xl" />
          <div className="min-w-0">
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-fg">{e.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-fg-secondary">
              {e.designation ?? "—"}
              <span className="font-mono text-[12.5px] text-fg-muted">{e.employeeCode}</span>
              <Badge tone={EMPLOYEE_STATUS[e.status].tone} dot>
                {EMPLOYEE_STATUS[e.status].label}
              </Badge>
            </p>
          </div>
        </div>
        {writable && lookups && assignOptions && (
          <div className="flex flex-wrap items-center gap-2">
            <EmployeeActions
              id={e.id}
              lookups={lookups}
              assignOptions={assignOptions}
              canAssign={e.status !== "EXITED"}
              initial={{
                employeeCode: e.employeeCode,
                name: e.name,
                email: e.email ?? "",
                phone: e.phone ?? "",
                designation: e.designation ?? "",
                departmentId: e.departmentId ?? "",
                locationId: e.locationId ?? "",
                joiningDate: toDateInput(e.joiningDate),
                exitDate: toDateInput(e.exitDate),
                status: e.status,
                notes: e.notes ?? "",
              }}
            />
          </div>
        )}
      </div>

      {offboarding && (
        <Card className="border-warning/30 bg-warning-soft/60">
          <div className="flex items-start gap-3 px-5 pt-5">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <h2 className="text-[15px] font-semibold text-fg">
                Offboarding: {[open.length && `${open.length} asset(s)`, e.licenseSeats.length && `${e.licenseSeats.length} license seat(s)`].filter(Boolean).join(" and ")} still with{" "}
                {e.name.split(" ")[0]}
              </h2>
              <p className="text-[13px] text-fg-secondary">
                {e.status === "LEAVING" && e.exitDate
                  ? `Last day ${formatDate(e.exitDate)} (${Math.max(0, daysBetween(today(), e.exitDate))} days). `
                  : "Marked as exited. "}
                Return assets to stock (or use Check in on the asset for damage notes) and revoke license seats.
              </p>
            </div>
          </div>
          <ul className="mt-3 border-t border-warning/20">
            {open.map((a) => (
              <li key={a.id} className="flex items-center gap-4 border-b border-warning/20 px-5 py-3 last:border-0">
                <Link href={`/assets/${a.asset.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-mono text-[12.5px] font-medium">{a.asset.assetTag}</span>
                  <span className="ml-2 text-[13.5px] text-fg-secondary">{a.asset.name}</span>
                </Link>
                <span className="hidden text-[12.5px] text-fg-muted sm:inline">Since {formatDate(a.issuedAt)}</span>
                {writable && <QuickReturnButton assignmentId={a.id} label={a.asset.assetTag} />}
              </li>
            ))}
            {e.licenseSeats.map((s) => (
              <li key={s.id} className="flex items-center gap-4 border-b border-warning/20 px-5 py-3 last:border-0">
                <Link href={`/licenses/${s.license.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="text-[12.5px] font-medium">License seat</span>
                  <span className="ml-2 text-[13.5px] text-fg-secondary">{s.license.name}</span>
                </Link>
                <span className="hidden text-[12.5px] text-fg-muted sm:inline">Since {formatDate(s.assignedAt)}</span>
                {writable && <RevokeSeatButton seatId={s.id} label={e.name} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assets held" value={e.heldAssets.length} />
        <StatCard label="Value held" value={formatMoney(heldValue)} sub="Purchase cost" />
        <StatCard label="Assets ever issued" value={new Set(e.assignments.map((a) => a.assetId)).size} />
        <StatCard label="Tickets raised" value={e.tickets.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Profile" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Email", value: e.email && <a className="hover:underline" href={`mailto:${e.email}`}>{e.email}</a> },
                { label: "Phone", value: e.phone },
                { label: "Department", value: e.department?.name },
                { label: "Location", value: e.location?.name },
                { label: "Joined", value: formatDate(e.joiningDate) },
                { label: "Exit date", value: e.exitDate ? formatDate(e.exitDate) : null },
                { label: "Notes", value: e.notes },
              ]}
            />
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <Tabs defaultValue="current">
            <TabsList>
              <TabsTrigger value="current">Current assets ({e.heldAssets.length})</TabsTrigger>
              <TabsTrigger value="history">Asset history ({e.assignments.length})</TabsTrigger>
              <TabsTrigger value="licenses">Licenses ({e.licenseSeats.length})</TabsTrigger>
              <TabsTrigger value="stock">Stock issued ({e.stockMovements.length})</TabsTrigger>
              <TabsTrigger value="tickets">Tickets ({e.tickets.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="current">
              <SimpleTable
                rows={e.heldAssets}
                rowKey={(a) => a.id}
                empty="No assets currently assigned."
                columns={[
                  { header: "Tag", cell: (a) => <Link href={`/assets/${a.id}`} className="font-mono text-[12.5px] font-medium hover:underline">{a.assetTag}</Link> },
                  { header: "Asset", cell: (a) => a.name },
                  { header: "Type", cell: (a) => a.type.name },
                  { header: "Condition", cell: (a) => ASSET_CONDITION[a.condition].label },
                  { header: "Cost", align: "right", cell: (a) => (a.purchaseCost ? formatMoney(a.purchaseCost) : "—") },
                ]}
              />
            </TabsContent>
            <TabsContent value="history">
              <SimpleTable
                rows={e.assignments}
                rowKey={(a) => a.id}
                empty="Never received an asset."
                columns={[
                  { header: "Tag", cell: (a) => <Link href={`/assets/${a.asset.id}`} className="font-mono text-[12.5px] font-medium hover:underline">{a.asset.assetTag}</Link> },
                  { header: "Asset", cell: (a) => a.asset.name },
                  { header: "Issued", cell: (a) => formatDate(a.issuedAt) },
                  { header: "Returned", cell: (a) => (a.returnedAt ? formatDate(a.returnedAt) : <Badge tone="success" dot>Current</Badge>) },
                  { header: "Days", align: "right", cell: (a) => daysBetween(a.issuedAt, a.returnedAt ?? today()) },
                  {
                    header: "Asset now",
                    cell: (a) => <Badge tone={ASSET_STATUS[a.asset.status].tone}>{ASSET_STATUS[a.asset.status].label}</Badge>,
                  },
                ]}
              />
            </TabsContent>
            <TabsContent value="licenses">
              <SimpleTable
                rows={e.licenseSeats}
                rowKey={(s) => s.id}
                empty="No license seats."
                columns={[
                  { header: "License", cell: (s) => <Link href={`/licenses/${s.license.id}`} className="font-medium hover:underline">{s.license.name}</Link> },
                  { header: "Since", cell: (s) => formatDate(s.assignedAt) },
                  { header: "Expires", cell: (s) => (s.license.expiryDate ? formatDate(s.license.expiryDate) : "Perpetual") },
                  ...(writable ? [{ header: "", className: "w-24", cell: (s: (typeof e.licenseSeats)[number]) => <RevokeSeatButton seatId={s.id} label={e.name} /> }] : []),
                ]}
              />
            </TabsContent>
            <TabsContent value="stock">
              <SimpleTable
                rows={e.stockMovements}
                rowKey={(m) => m.id}
                empty="No consumables issued."
                columns={[
                  { header: "Date", cell: (m) => formatDate(m.occurredAt) },
                  { header: "Item", cell: (m) => <Link href={`/inventory/${m.item.id}`} className="hover:underline">{m.item.name}</Link> },
                  { header: "Qty", align: "right", cell: (m) => `${-m.quantityChange} ${m.item.unit}` },
                  { header: "Note", cell: (m) => <span className="text-fg-secondary">{m.notes ?? "—"}</span> },
                ]}
              />
            </TabsContent>
            <TabsContent value="tickets">
              <SimpleTable
                rows={e.tickets}
                rowKey={(t) => t.id}
                empty="No tickets for this employee."
                columns={[
                  {
                    header: "Ticket",
                    cell: (t) => (
                      <span className="flex items-center gap-2">
                        <PriorityDot priority={t.priority} />
                        <Link href={`/tickets/${t.id}`} className="font-mono text-[12.5px] text-fg-muted hover:underline">{t.ticketNumber}</Link>
                      </span>
                    ),
                  },
                  { header: "Title", cell: (t) => <Link href={`/tickets/${t.id}`} className="hover:underline">{t.title}</Link> },
                  { header: "Category", cell: (t) => t.category?.name ?? "—" },
                  { header: "Status", cell: (t) => <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge> },
                  { header: "Opened", cell: (t) => formatDate(t.createdAt) },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function EmployeePage(props: PageProps<"/employees/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
