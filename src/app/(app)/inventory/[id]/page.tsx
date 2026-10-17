import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimpleTable } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageHeader, PageSkeleton, StatCard } from "@/components/ui/page";
import { ItemActions } from "@/features/inventory/item-actions";
import { getInventoryLookups, getItem, itemFormValues } from "@/features/inventory/queries";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import { canWrite, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock item" };

const TYPE = { STOCK_IN: { label: "Stock in", tone: "success" }, STOCK_OUT: { label: "Issued", tone: "info" }, ADJUSTMENT: { label: "Adjustment", tone: "neutral" } } as const;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getItem(id)]);
  if (!data) notFound();
  const { item: i, totalSpend, issued90 } = data;
  const writable = canWrite(user.role);
  const lookups = writable ? await getInventoryLookups() : null;
  const unitCost = i.unitCost === null ? null : toNumber(i.unitCost);
  const low = i.quantity <= i.minQuantity;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={i.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-fg">{i.sku}</span>
            <Badge>{i.category}</Badge>
            {low && <Badge tone={i.quantity === 0 ? "danger" : "warning"}>{i.quantity === 0 ? "Out of stock" : "Low stock"}</Badge>}
          </span>
        }
        actions={
          writable &&
          lookups && (
            <ItemActions
              target={{ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, unitCost, vendorId: i.vendorId }}
              initial={itemFormValues(i)}
              lookups={lookups}
            />
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="On hand" value={<span className={cn(i.quantity === 0 ? "text-danger" : low && "text-warning")}>{`${i.quantity} ${i.unit}`}</span>} sub={`Reorder at ${i.minQuantity}`} />
        <StatCard label="Stock value" value={unitCost === null ? "—" : formatMoney(unitCost * i.quantity)} sub={unitCost === null ? undefined : `${formatMoney(unitCost)} each`} />
        <StatCard label="Issued · 90 days" value={issued90} sub={issued90 ? `≈ ${(issued90 / 3).toFixed(1)} per month` : "No usage recorded"} />
        <StatCard label="Spent on this item" value={formatMoney(totalSpend)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Details" />
          <CardBody>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Location", value: i.location?.name },
                { label: "Usual vendor", value: i.vendor && <Link href={`/vendors/${i.vendor.id}`} className="hover:underline">{i.vendor.name}</Link> },
                { label: "Unit", value: i.unit },
                { label: "Notes", value: i.notes },
              ]}
            />
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-[15px] font-semibold text-fg">Movement history</h2>
          <SimpleTable
            rows={i.movements}
            rowKey={(m) => m.id}
            empty="No movements yet."
            columns={[
              { header: "When", cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.occurredAt)}</span> },
              { header: "Type", cell: (m) => <Badge tone={TYPE[m.type].tone}>{TYPE[m.type].label}</Badge> },
              {
                header: "Details",
                cell: (m) => (
                  <span className="line-clamp-2 text-fg-secondary">
                    {m.employee && (
                      <Link href={`/employees/${m.employee.id}`} className="text-fg hover:underline">
                        {m.employee.name}
                      </Link>
                    )}
                    {m.ticket && (
                      <>
                        {m.employee ? " · " : ""}
                        <Link href={`/tickets/${m.ticket.id}`} className="font-mono text-[12.5px] hover:underline">
                          {m.ticket.ticketNumber}
                        </Link>
                      </>
                    )}
                    {m.invoiceNumber && <span className="font-mono text-[12px]">Inv {m.invoiceNumber}</span>}
                    {(m.employee || m.ticket || m.invoiceNumber) && m.notes ? " · " : ""}
                    {m.notes}
                  </span>
                ),
              },
              { header: "By", cell: (m) => m.createdBy?.name ?? "—" },
              {
                header: "Change",
                align: "right",
                cell: (m) => <span className={cn("font-medium", m.quantityChange > 0 ? "text-success" : "text-fg")}>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</span>,
              },
              { header: "After", align: "right", cell: (m) => m.quantityAfter },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function ItemPage(props: PageProps<"/inventory/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
