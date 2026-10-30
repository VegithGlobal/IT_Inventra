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
import { LinkedDocuments } from "@/features/documents/linked-documents";
import { getLookups } from "@/features/employees/queries";
import { DueLabel } from "@/features/subscriptions/due-label";
import { getSubscription, subscriptionFormValues } from "@/features/subscriptions/queries";
import { RevealCredentials, SubscriptionActions, VoidPaymentButton } from "@/features/subscriptions/subscription-actions";
import { monthlyEquivalent } from "@/lib/billing";
import { daysBetween, today } from "@/lib/dates";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { BILLING_CYCLE, PAYMENT_MODE, subscriptionCategoryLabel, SUBSCRIPTION_STATUS } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Subscription" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getSubscription(id)]);
  if (!data) notFound();
  const { sub: s, activity, paidTotal } = data;
  const writable = canWrite(user.role);
  const lookups = writable ? await getLookups() : null;
  const amount = toNumber(s.amount);
  const days = daysBetween(today(), s.nextDueDate);
  const cycleLabel = s.billingCycle === "CUSTOM" ? `Every ${s.customCycleDays} days` : BILLING_CYCLE[s.billingCycle];
  const latestPaymentId = s.payments[0]?.id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={s.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={SUBSCRIPTION_STATUS[s.status].tone} dot>
              {SUBSCRIPTION_STATUS[s.status].label}
            </Badge>
            <span>
              {subscriptionCategoryLabel(s.category)}
              {s.vendor && (
                <>
                  {" · "}
                  <Link href={`/vendors/${s.vendor.id}`} className="hover:underline">
                    {s.vendor.name}
                  </Link>
                </>
              )}
            </span>
          </span>
        }
        actions={
          writable &&
          lookups && (
            <SubscriptionActions
              target={{ id: s.id, name: s.name, amount, nextDueDate: s.nextDueDate, billingCycle: s.billingCycle, customCycleDays: s.customCycleDays, paymentMode: s.paymentMode }}
              initial={subscriptionFormValues(s)}
              lookups={lookups}
              hasCredentials={!!s.credentialsEnc}
              cancelled={s.status === "CANCELLED"}
            />
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Next due" value={<span className="text-[20px]"><DueLabel date={s.nextDueDate} days={days} inactive={s.status !== "ACTIVE"} /></span>} />
        <StatCard label={`Amount · ${cycleLabel.toLowerCase()}`} value={formatMoney(amount, s.currency)} sub={`≈ ${formatMoney(monthlyEquivalent(amount, s.billingCycle, s.customCycleDays))} / month`} />
        <StatCard label="Paid to date" value={formatMoney(paidTotal)} sub={`${s.payments.length} payment(s) since ${formatDate(s.startDate)}`} />
        <StatCard label="Last payment" value={<span className="text-[20px]">{s.payments[0] ? formatDate(s.payments[0].paidAt) : "—"}</span>} sub={s.payments[0] ? `${formatMoney(s.payments[0].amount)} · ${PAYMENT_MODE[s.payments[0].paymentMode]}` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Details" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Account / customer ID", value: s.accountId && <span className="font-mono text-[12.5px]">{s.accountId}</span> },
                { label: "Plan", value: s.planDetails },
                { label: "Billing cycle", value: cycleLabel },
                { label: "Started", value: formatDate(s.startDate) },
                { label: "Auto-renew", value: s.autoRenew ? "Yes" : "No" },
                { label: "Payment method", value: s.paymentMode ? PAYMENT_MODE[s.paymentMode] : null },
                { label: "Reminders", value: Array.isArray(s.reminderDays) ? `${(s.reminderDays as number[]).join(", ")} days before` : "Default (Settings)" },
                { label: "Location", value: s.location?.name },
                { label: "Department", value: s.department?.name },
                {
                  label: "Login",
                  value: s.loginUrl && (
                    <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {s.loginUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="size-3" />
                    </a>
                  ),
                },
                { label: "Credentials", value: s.credentialsEnc ? writable ? <RevealCredentials id={s.id} /> : "Stored (encrypted)" : null },
                { label: "Notes", value: s.notes && <span className="whitespace-pre-line">{s.notes}</span> },
              ]}
            />
          </CardBody>
        </Card>

        <div className="min-w-0 lg:col-span-2">
          <Tabs defaultValue="payments">
            <TabsList>
              <TabsTrigger value="payments">Payment history ({s.payments.length})</TabsTrigger>
              <TabsTrigger value="documents">Invoices ({s.documents.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="payments">
              <SimpleTable
                rows={s.payments}
                rowKey={(p) => p.id}
                empty="No payments recorded yet. Use “Mark as paid” when you pay."
                columns={[
                  { header: "Paid on", cell: (p) => formatDate(p.paidAt) },
                  { header: "Period", cell: (p) => <span className="text-fg-secondary">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</span> },
                  { header: "Mode", cell: (p) => PAYMENT_MODE[p.paymentMode] },
                  { header: "Reference", cell: (p) => <span className="font-mono text-[12px] text-fg-muted">{p.transactionRef ?? "—"}</span> },
                  { header: "Amount", align: "right", cell: (p) => formatMoney(p.amount) },
                  ...(writable
                    ? [{ header: "", className: "w-20", cell: (p: (typeof s.payments)[number]) => (p.id === latestPaymentId ? <VoidPaymentButton paymentId={p.id} /> : null) }]
                    : []),
                ]}
              />
            </TabsContent>
            <TabsContent value="documents">
              <LinkedDocuments documents={s.documents} link={{ subscriptionId: s.id }} canWrite={writable} defaults={{ vendorId: s.vendorId ?? "", type: "INVOICE" }} />
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

export default function SubscriptionPage(props: PageProps<"/subscriptions/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
