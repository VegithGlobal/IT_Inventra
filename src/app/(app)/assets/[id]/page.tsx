import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityList } from "@/components/activity-list";
import { SimpleTable } from "@/components/simple-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageHeader, PageSkeleton, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetActions } from "@/features/assets/asset-actions";
import { assetFormValues, getAsset, lastUsers } from "@/features/assets/queries";
import { getAssignOptions } from "@/features/assignments/queries";
import { LinkedDocuments } from "@/features/documents/linked-documents";
import { getLookups } from "@/features/employees/queries";
import { SendToRepairButton } from "@/features/maintenance/dialogs";
import { getMaintenanceLookups } from "@/features/maintenance/queries";
import { NewTicketButton } from "@/features/tickets/quick-add";
import { daysBetween, today } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { ASSET_CONDITION, ASSET_STATUS, TICKET_STATUS } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Asset" };

function duration(from: Date, to: Date | null) {
  const days = daysBetween(from, to ?? today());
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `${months} months` : `${(days / 365).toFixed(1)} years`;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getAsset(id)]);
  if (!data) notFound();
  const { asset: a, activity, depreciation } = data;
  const writable = canWrite(user.role);
  const [lookups, assignOptions, repairLookups] = writable ? await Promise.all([getLookups(), getAssignOptions(), getMaintenanceLookups()]) : [null, null, null];
  const openRepair = a.maintenance.find((m) => m.status === "OPEN");
  const open = a.assignments.find((x) => !x.returnedAt) ?? null;
  const specs = Object.entries((a.specs ?? {}) as Record<string, string>);
  const warrantyDays = a.warrantyEnd ? daysBetween(today(), a.warrantyEnd) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-fg">{a.assetTag}</span>
            <Badge tone={ASSET_STATUS[a.status].tone} dot>
              {ASSET_STATUS[a.status].label}
            </Badge>
            <span>· {a.type.name}</span>
          </span>
        }
        actions={
          writable &&
          lookups &&
          assignOptions && (
            <AssetActions
              asset={{ id: a.id, assetTag: a.assetTag, name: a.name, status: a.status }}
              initial={assetFormValues(a)}
              lookups={lookups}
              assignOptions={assignOptions}
              openAssignment={open ? { id: open.id, employeeId: open.employeeId, employeeName: open.employee.name, condition: open.conditionAtIssue } : null}
              canDelete={user.role === "ADMIN"}
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Assigned to"
          value={
            a.currentHolder ? (
              <Link href={`/employees/${a.currentHolder.id}`} className="flex items-center gap-2 text-[17px] hover:underline">
                <Avatar name={a.currentHolder.name} size="sm" />
                <span className="truncate">{a.currentHolder.name}</span>
              </Link>
            ) : (
              <span className="text-[17px] text-fg-muted">Nobody</span>
            )
          }
          sub={open ? `Since ${formatDate(open.issuedAt)}` : undefined}
        />
        <StatCard label="Purchase cost" value={a.purchaseCost ? formatMoney(a.purchaseCost) : "—"} sub={a.purchaseDate ? `Bought ${formatDate(a.purchaseDate)}` : undefined} />
        <StatCard
          label="Book value"
          value={a.purchaseCost ? formatMoney(depreciation.bookValue) : "—"}
          sub={a.purchaseCost ? `${depreciation.monthsElapsed} of ${a.type.usefulLifeMonths} months · straight-line` : "Add a cost to track depreciation"}
        />
        <StatCard
          label="Warranty"
          value={<span className="text-[17px]">{a.warrantyEnd ? formatDate(a.warrantyEnd) : "—"}</span>}
          trend={
            warrantyDays === null ? null : warrantyDays < 0 ? (
              <Badge tone="neutral">Expired</Badge>
            ) : warrantyDays <= 30 ? (
              <Badge tone="warning">{warrantyDays}d left</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Assignment history ({a.assignments.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({a.maintenance.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({a.tickets.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({a.documents.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Details" />
              <CardBody>
                <DetailList
                  items={[
                    { label: "Brand / model", value: [a.brand, a.model].filter(Boolean).join(" ") || null },
                    { label: "Serial number", value: a.serialNumber && <span className="font-mono text-[12.5px]">{a.serialNumber}</span> },
                    { label: "Previous users", value: lastUsers(a).join(", ") },
                    { label: "Condition", value: ASSET_CONDITION[a.condition].label },
                    { label: "Location", value: a.location?.name },
                    { label: "Department", value: a.department?.name },
                    { label: "Vendor", value: a.vendor && <Link href={`/vendors/${a.vendor.id}`} className="hover:underline">{a.vendor.name}</Link> },
                    { label: "Invoice number", value: a.invoiceNumber },
                    { label: "Warranty", value: a.warrantyStart || a.warrantyEnd ? `${formatDate(a.warrantyStart)} → ${formatDate(a.warrantyEnd)}` : null },
                  ]}
                />
                {a.notes && <p className="mt-5 border-t border-line pt-4 text-[13.5px] whitespace-pre-line text-fg-secondary">{a.notes}</p>}
              </CardBody>
            </Card>
            <Card className="h-fit">
              <CardHeader title="Specs" />
              <CardBody>
                {specs.length ? (
                  <DetailList className="sm:grid-cols-1" items={specs.map(([k, v]) => ({ label: k.toUpperCase() === "OS" || k.length <= 3 ? k.toUpperCase() : k, value: v }))} />
                ) : (
                  <p className="text-[13.5px] text-fg-muted">No specs recorded.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <SimpleTable
            rows={a.assignments}
            rowKey={(x) => x.id}
            empty="Never assigned."
            columns={[
              {
                header: "Employee",
                cell: (x) => (
                  <Link href={`/employees/${x.employee.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Avatar name={x.employee.name} size="xs" />
                    {x.employee.name}
                  </Link>
                ),
              },
              { header: "Issued", cell: (x) => formatDate(x.issuedAt) },
              { header: "Returned", cell: (x) => (x.returnedAt ? formatDate(x.returnedAt) : <Badge tone="success" dot>Current</Badge>) },
              { header: "Duration", cell: (x) => duration(x.issuedAt, x.returnedAt) },
              {
                header: "Condition",
                cell: (x) => `${ASSET_CONDITION[x.conditionAtIssue].label}${x.conditionAtReturn ? ` → ${ASSET_CONDITION[x.conditionAtReturn].label}` : ""}`,
              },
              { header: "Notes", cell: (x) => <span className="line-clamp-1 text-fg-secondary">{x.damageNotes ?? x.returnNotes ?? x.issueNotes ?? "—"}</span> },
              {
                header: "Forms",
                cell: (x) => (
                  <span className="flex gap-3 text-[12.5px]">
                    <Link href={`/print/handover/${x.id}`} target="_blank" className="text-fg-secondary hover:text-fg hover:underline">
                      Handover
                    </Link>
                    {x.returnedAt && (
                      <Link href={`/print/return/${x.id}`} target="_blank" className="text-fg-secondary hover:text-fg hover:underline">
                        Return
                      </Link>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="maintenance">
          {repairLookups && !openRepair && (
            <div className="mb-3 flex justify-end">
              <SendToRepairButton lookups={repairLookups} preset={{ assetId: a.id }} />
            </div>
          )}
          <SimpleTable
            rows={a.maintenance}
            rowKey={(m) => m.id}
            empty="No repairs or services logged."
            columns={[
              { header: "Issue", cell: (m) => <Link href="/maintenance" className="hover:underline">{m.issue}</Link> },
              { header: "Sent", cell: (m) => formatDate(m.sentAt) },
              { header: "Vendor", cell: (m) => m.vendor?.name ?? "—" },
              { header: "Returned", cell: (m) => (m.returnedAt ? formatDate(m.returnedAt) : <Badge tone="warning" dot>At repair</Badge>) },
              { header: "Outcome", cell: (m) => <span className="line-clamp-1 text-fg-secondary">{m.outcome ?? "—"}</span> },
              { header: "Cost", align: "right", cell: (m) => (m.cost ? formatMoney(m.cost) : "—") },
            ]}
          />
        </TabsContent>

        <TabsContent value="tickets">
          {writable && (
            <div className="mb-3 flex justify-end">
              <NewTicketButton label="New ticket for this asset" preset={{ assetId: a.id, requesterId: a.currentHolderId ?? "", categoryId: "" }} />
            </div>
          )}
          <SimpleTable
            rows={a.tickets}
            rowKey={(t) => t.id}
            empty="No tickets linked to this asset."
            columns={[
              { header: "Ticket", cell: (t) => <Link href={`/tickets/${t.id}`} className="font-mono text-[12.5px] text-fg-muted hover:underline">{t.ticketNumber}</Link> },
              { header: "Title", cell: (t) => <Link href={`/tickets/${t.id}`} className="hover:underline">{t.title}</Link> },
              { header: "Requester", cell: (t) => t.requester.name },
              { header: "Status", cell: (t) => <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge> },
              { header: "Opened", cell: (t) => formatDate(t.createdAt) },
            ]}
          />
        </TabsContent>

        <TabsContent value="documents">
          <LinkedDocuments documents={a.documents} link={{ assetId: a.id }} canWrite={writable} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityList entries={activity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AssetPage(props: PageProps<"/assets/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
