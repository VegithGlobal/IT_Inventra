import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityList } from "@/components/activity-list";
import { SimpleTable } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageHeader, PageSkeleton, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickDisableButton, SystemActions } from "@/features/accounts/account-ui";
import { AccountStatusBadge, MfaLabel } from "@/features/accounts/accounts-view";
import { getAccountLookups, getSystem, systemFormValues } from "@/features/accounts/queries";
import { formatDate } from "@/lib/format";
import { EMPLOYEE_STATUS, SYSTEM_CATEGORY } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "System" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getSystem(id)]);
  if (!data) notFound();
  const { system: s, activity } = data;
  const writable = canWrite(user.role);
  const lookups = writable ? await getAccountLookups() : null;
  const active = s.accounts.filter((a) => a.status === "ACTIVE");
  const closed = s.accounts.filter((a) => a.status !== "ACTIVE");
  const leavers = active.filter((a) => a.employee.status !== "ACTIVE");
  type A = (typeof s.accounts)[number];

  const columns = (withClose: boolean) => [
    {
      header: "Employee",
      cell: (a: A) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/employees/${a.employee.id}`} className="font-medium hover:underline">
            {a.employee.name}
          </Link>
          {a.employee.status !== "ACTIVE" && <Badge tone={EMPLOYEE_STATUS[a.employee.status].tone}>{EMPLOYEE_STATUS[a.employee.status].label}</Badge>}
        </span>
      ),
    },
    { header: "Login ID", cell: (a: A) => <Link href={`/accounts/${a.id}`} className="font-mono text-[12.5px] break-all hover:underline">{a.username}</Link> },
    { header: "Access", cell: (a: A) => a.accessLevel ?? "—" },
    ...(withClose
      ? [
          { header: "2FA", cell: (a: A) => <MfaLabel on={a.mfaEnabled} /> },
          { header: "Given on", cell: (a: A) => formatDate(a.grantedAt) },
          ...(writable ? [{ header: "", className: "w-28", cell: (a: A) => (a.employee.status !== "ACTIVE" ? <QuickDisableButton id={a.id} label={a.employee.name} /> : null) }] : []),
        ]
      : [
          { header: "Status", cell: (a: A) => <AccountStatusBadge status={a.status} /> },
          { header: "Closed on", cell: (a: A) => formatDate(a.closedAt) },
        ]),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={s.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{SYSTEM_CATEGORY[s.category]}</Badge>
            {s.vendor && (
              <Link href={`/vendors/${s.vendor.id}`} className="hover:underline">
                {s.vendor.name}
              </Link>
            )}
          </span>
        }
        actions={writable && lookups && <SystemActions id={s.id} initial={systemFormValues(s)} lookups={lookups} hasActive={active.length > 0} />}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active logins" value={active.length} />
        <StatCard label="Leavers to block" value={<span className={cn(leavers.length > 0 && "text-danger")}>{leavers.length}</span>} />
        <StatCard label="Without 2FA" value={active.filter((a) => !a.mfaEnabled).length} />
        <StatCard label="Closed" value={closed.length} sub="Kept for history" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Details" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                {
                  label: "Login / admin URL",
                  value: s.loginUrl && (
                    <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all hover:underline">
                      {s.loginUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ),
                },
                { label: "How to block someone", value: s.offboardingSteps ? <span className="whitespace-pre-line">{s.offboardingSteps}</span> : <span className="text-fg-muted">Not written yet</span> },
                { label: "Notes", value: s.notes && <span className="whitespace-pre-line">{s.notes}</span> },
              ]}
            />
          </CardBody>
        </Card>
        <div className="min-w-0 lg:col-span-2">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <SimpleTable rows={active} rowKey={(a) => a.id} empty="Nobody has an active login here." columns={columns(true)} />
            </TabsContent>
            <TabsContent value="closed">
              <SimpleTable rows={closed} rowKey={(a) => a.id} empty="No closed logins." columns={columns(false)} />
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

export default function SystemPage(props: PageProps<"/accounts/systems/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
