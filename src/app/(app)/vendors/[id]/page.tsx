import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimpleTable } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageHeader, PageSkeleton, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVendor } from "@/features/vendors/queries";
import { VendorActions } from "@/features/vendors/vendor-actions";
import { formatDate, formatMoney } from "@/lib/format";
import { ASSET_STATUS, BILLING_CYCLE, DOCUMENT_TYPE, SUBSCRIPTION_STATUS, VENDOR_CATEGORY } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Vendor" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getVendor(id)]);
  if (!data) notFound();
  const { vendor: v, totalSpend, expenseCount } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={v.name}
        description={
          <span className="flex items-center gap-2">
            <Badge>{VENDOR_CATEGORY[v.category]}</Badge>
            {v.gstin && <span className="font-mono text-[12.5px]">GSTIN {v.gstin}</span>}
          </span>
        }
        actions={
          canWrite(user.role) && (
            <VendorActions
              id={v.id}
              initial={{
                name: v.name,
                category: v.category,
                contactPerson: v.contactPerson ?? "",
                phone: v.phone ?? "",
                email: v.email ?? "",
                address: v.address ?? "",
                gstin: v.gstin ?? "",
                website: v.website ?? "",
                notes: v.notes ?? "",
              }}
            />
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total spend" value={formatMoney(totalSpend)} sub={`${expenseCount} expense(s)`} />
        <StatCard label="Assets bought" value={v.assets.length} />
        <StatCard label="Subscriptions" value={v.subscriptions.length} />
        <StatCard label="Documents" value={v.documents.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Contact" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Contact person", value: v.contactPerson },
                { label: "Phone", value: v.phone && <a href={`tel:${v.phone}`} className="hover:underline">{v.phone}</a> },
                { label: "Email", value: v.email && <a href={`mailto:${v.email}`} className="hover:underline">{v.email}</a> },
                {
                  label: "Website",
                  value: v.website && (
                    <a href={v.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {v.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
                    </a>
                  ),
                },
                { label: "Address", value: v.address },
                { label: "Notes", value: v.notes },
              ]}
            />
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="subscriptions">
            <TabsList>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="subscriptions">
              <SimpleTable
                rows={v.subscriptions}
                rowKey={(s) => s.id}
                empty="No subscriptions with this vendor."
                columns={[
                  { header: "Service", cell: (s) => <Link href={`/subscriptions/${s.id}`} className="font-medium hover:underline">{s.name}</Link> },
                  { header: "Cycle", cell: (s) => BILLING_CYCLE[s.billingCycle] },
                  { header: "Next due", cell: (s) => formatDate(s.nextDueDate) },
                  { header: "Status", cell: (s) => <Badge tone={SUBSCRIPTION_STATUS[s.status].tone}>{SUBSCRIPTION_STATUS[s.status].label}</Badge> },
                  { header: "Amount", align: "right", cell: (s) => formatMoney(s.amount) },
                ]}
              />
            </TabsContent>
            <TabsContent value="assets">
              <SimpleTable
                rows={v.assets}
                rowKey={(a) => a.id}
                empty="No assets bought from this vendor."
                columns={[
                  { header: "Tag", cell: (a) => <Link href={`/assets/${a.id}`} className="font-mono text-[12.5px] hover:underline">{a.assetTag}</Link> },
                  { header: "Name", cell: (a) => a.name },
                  { header: "Purchased", cell: (a) => formatDate(a.purchaseDate) },
                  { header: "Status", cell: (a) => <Badge tone={ASSET_STATUS[a.status].tone} dot>{ASSET_STATUS[a.status].label}</Badge> },
                  { header: "Cost", align: "right", cell: (a) => formatMoney(a.purchaseCost) },
                ]}
              />
            </TabsContent>
            <TabsContent value="expenses">
              <SimpleTable
                rows={v.expenses}
                rowKey={(e) => e.id}
                empty="No expenses recorded for this vendor."
                columns={[
                  { header: "Date", cell: (e) => formatDate(e.date) },
                  { header: "Description", cell: (e) => <span className="line-clamp-1">{e.description}</span> },
                  { header: "Category", cell: (e) => e.category.name },
                  { header: "Total", align: "right", cell: (e) => formatMoney(e.total) },
                ]}
              />
            </TabsContent>
            <TabsContent value="documents">
              <SimpleTable
                rows={v.documents}
                rowKey={(d) => d.id}
                empty="No documents from this vendor."
                columns={[
                  { header: "Title", cell: (d) => <a href={`/api/files/${d.id}`} target="_blank" className="font-medium hover:underline">{d.title}</a> },
                  { header: "Type", cell: (d) => DOCUMENT_TYPE[d.type] },
                  { header: "Invoice #", cell: (d) => d.invoiceNumber ?? "—" },
                  { header: "Date", cell: (d) => formatDate(d.invoiceDate) },
                  { header: "Amount", align: "right", cell: (d) => (d.amount ? formatMoney(d.amount) : "—") },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function VendorPage(props: PageProps<"/vendors/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
