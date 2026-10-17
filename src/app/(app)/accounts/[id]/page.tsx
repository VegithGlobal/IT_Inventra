import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityList } from "@/components/activity-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageHeader, PageSkeleton } from "@/components/ui/page";
import { AccountActions, RevealPassword } from "@/features/accounts/account-ui";
import { AccountStatusBadge, MfaLabel } from "@/features/accounts/accounts-view";
import { accountFormValues, getAccount, getAccountLookups } from "@/features/accounts/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACCOUNT_STATUS, EMPLOYEE_STATUS, SYSTEM_CATEGORY } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Login" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getAccount(id)]);
  if (!data) notFound();
  const { account: a, activity } = data;
  const writable = canWrite(user.role);
  const lookups = writable ? await getAccountLookups() : null;
  const e = a.employee;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${a.system.name} · ${a.username}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AccountStatusBadge status={a.status} />
            <span>
              <Link href={`/employees/${e.id}`} className="hover:underline">
                {e.name}
              </Link>{" "}
              <span className="font-mono text-[12.5px] text-fg-muted">{e.employeeCode}</span>
            </span>
            {e.status !== "ACTIVE" && <Badge tone={EMPLOYEE_STATUS[e.status].tone}>{EMPLOYEE_STATUS[e.status].label}</Badge>}
          </span>
        }
        actions={writable && lookups && <AccountActions id={a.id} initial={accountFormValues(a)} lookups={lookups} hasPassword={!!a.passwordEnc} active={a.status === "ACTIVE"} />}
      />

      {a.status === "ACTIVE" && e.status !== "ACTIVE" && (
        <Card className="border-danger/25 bg-danger-soft/50">
          <CardBody className="text-[13.5px] text-fg">
            <p className="font-semibold">
              {e.name} is {e.status === "LEAVING" ? `leaving${e.exitDate ? ` on ${formatDate(e.exitDate)}` : ""}` : "no longer with the company"} — block this login.
            </p>
            {a.system.offboardingSteps && <p className="mt-1 whitespace-pre-line text-fg-secondary">{a.system.offboardingSteps}</p>}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Login" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "System", value: <Link href={`/accounts/systems/${a.system.id}`} className="hover:underline">{a.system.name}</Link> },
                { label: "Category", value: SYSTEM_CATEGORY[a.system.category] },
                { label: "Login ID", value: <span className="font-mono text-[12.5px] break-all">{a.username}</span> },
                { label: "Account type", value: a.personal ? "Employee's own account used for work" : "Company account" },
                { label: "Access level", value: a.accessLevel },
                { label: "2FA", value: <MfaLabel on={a.mfaEnabled} /> },
                { label: "Given on", value: a.grantedAt ? formatDate(a.grantedAt) : null },
                { label: "Password", value: a.passwordEnc ? (writable ? <RevealPassword id={a.id} /> : "Stored (encrypted)") : "Not stored" },
                {
                  label: "Sign-in page",
                  value: a.system.loginUrl && (
                    <a href={a.system.loginUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {a.system.loginUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="size-3" />
                    </a>
                  ),
                },
                { label: "Notes", value: a.notes && <span className="whitespace-pre-line">{a.notes}</span> },
              ]}
            />
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {a.status !== "ACTIVE" && (
            <Card>
              <CardHeader title="Access closed" />
              <CardBody>
                <DetailList
                  items={[
                    { label: "Outcome", value: ACCOUNT_STATUS[a.status].label },
                    { label: "When", value: a.closedAt ? formatDateTime(a.closedAt) : null },
                    { label: "By", value: a.closedBy?.name },
                    { label: "Note", value: a.closeNote },
                  ]}
                />
              </CardBody>
            </Card>
          )}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Activity</h2>
              <p className="text-[13px] text-fg-muted">Changes, closures and every time the password was viewed.</p>
            </div>
            <ActivityList entries={activity} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage(props: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
