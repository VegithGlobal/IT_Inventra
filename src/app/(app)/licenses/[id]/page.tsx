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
import { LicenseActions, RevealKey, RevokeSeatButton, SeatBar } from "@/features/licenses/license-ui";
import { ExpiryLabel } from "@/features/licenses/licenses-view";
import { getLicense, getLicenseLookups, licenseFormValues } from "@/features/licenses/queries";
import { daysBetween, today } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { LICENSE_TYPE } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "License" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getLicense(id)]);
  if (!data) notFound();
  const { license: l, activity } = data;
  const writable = canWrite(user.role);
  const lookups = writable ? await getLicenseLookups() : null;
  const active = l.seats.filter((s) => !s.revokedAt);
  const past = l.seats.filter((s) => s.revokedAt);
  const site = l.type === "SITE";
  const days = l.expiryDate ? daysBetween(today(), l.expiryDate) : null;
  // Seats held by people who have left — worth reclaiming.
  const reclaim = active.filter((s) => s.employee && s.employee.status !== "ACTIVE");

  const seatColumns = [
    {
      header: "Assigned to",
      cell: (s: (typeof l.seats)[number]) =>
        s.employee ? (
          <Link href={`/employees/${s.employee.id}`} className="flex items-center gap-2 font-medium hover:underline">
            <Avatar name={s.employee.name} size="xs" />
            {s.employee.name}
            {s.employee.status !== "ACTIVE" && <Badge tone="warning">{s.employee.status === "LEAVING" ? "Leaving" : "Exited"}</Badge>}
          </Link>
        ) : s.asset ? (
          <Link href={`/assets/${s.asset.id}`} className="hover:underline">
            <span className="font-mono text-[12.5px] font-medium">{s.asset.assetTag}</span> {s.asset.name}
            {s.asset.currentHolder && <span className="text-fg-muted"> · {s.asset.currentHolder.name}</span>}
          </Link>
        ) : (
          "—"
        ),
    },
    { header: "Department", cell: (s: (typeof l.seats)[number]) => s.employee?.department?.name ?? "—" },
    { header: "Since", cell: (s: (typeof l.seats)[number]) => formatDate(s.assignedAt) },
    { header: "Note", cell: (s: (typeof l.seats)[number]) => <span className="text-fg-secondary">{s.notes ?? "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{LICENSE_TYPE[l.type]}</Badge>
            {l.vendor && (
              <Link href={`/vendors/${l.vendor.id}`} className="hover:underline">
                {l.vendor.name}
              </Link>
            )}
          </span>
        }
        actions={
          writable &&
          lookups && (
            <LicenseActions id={l.id} type={l.type} initial={licenseFormValues(l)} lookups={lookups} hasKey={!!l.licenseKeyEnc} seatsFull={!site && active.length >= l.totalSeats} />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Seats" value={<span className="text-[20px]"><SeatBar used={active.length} total={l.totalSeats} site={site} /></span>} sub={site ? "Site licence — unlimited" : `${Math.max(0, l.totalSeats - active.length)} free`} />
        <StatCard label="Expiry" value={<span className="text-[20px]"><ExpiryLabel date={l.expiryDate} days={days} /></span>} />
        <StatCard label="Cost" value={l.cost ? formatMoney(l.cost) : "—"} sub={l.cost && !site && l.totalSeats ? `${formatMoney(Number(l.cost) / l.totalSeats)} per seat` : undefined} />
        <StatCard label="To reclaim" value={reclaim.length} sub={reclaim.length ? "Seats held by leaving/exited staff" : "None"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Details" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Purchased", value: formatDate(l.purchaseDate) },
                {
                  label: "Subscription",
                  value: l.subscription && (
                    <Link href={`/subscriptions/${l.subscription.id}`} className="hover:underline">
                      {l.subscription.name} · renews {formatDate(l.subscription.nextDueDate)}
                    </Link>
                  ),
                },
                { label: "License key", value: l.licenseKeyEnc ? writable ? <RevealKey id={l.id} /> : "Stored (encrypted)" : null },
                { label: "Notes", value: l.notes && <span className="whitespace-pre-line">{l.notes}</span> },
              ]}
            />
          </CardBody>
        </Card>
        <div className="min-w-0 lg:col-span-2">
          <Tabs defaultValue="seats">
            <TabsList>
              <TabsTrigger value="seats">Active seats ({active.length})</TabsTrigger>
              <TabsTrigger value="history">Past seats ({past.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="seats">
              <SimpleTable
                rows={active}
                rowKey={(s) => s.id}
                empty="No seats assigned yet."
                columns={[
                  ...seatColumns,
                  ...(writable
                    ? [{ header: "", className: "w-24", cell: (s: (typeof l.seats)[number]) => <RevokeSeatButton seatId={s.id} label={s.employee?.name ?? s.asset?.assetTag ?? "seat"} /> }]
                    : []),
                ]}
              />
            </TabsContent>
            <TabsContent value="history">
              <SimpleTable
                rows={past}
                rowKey={(s) => s.id}
                empty="No revoked seats."
                columns={[...seatColumns.filter((c) => c.header !== "Note"), { header: "Revoked", cell: (s) => formatDate(s.revokedAt) }]}
              />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityList entries={activity} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function LicensePage(props: PageProps<"/licenses/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
