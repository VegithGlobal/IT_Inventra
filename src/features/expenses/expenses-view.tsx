"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Archive, MoreHorizontal, Paperclip, Pencil, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useActionRunner, type Option } from "@/components/forms";
import { useQueryFlag } from "@/components/use-query-flag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SlideOver } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatMoney, formatMoneyShort } from "@/lib/format";
import { EXPENSE_SOURCE, PAYMENT_MODE, categoryColor, toOptions } from "@/lib/options";
import { cn } from "@/lib/utils";
import { archiveExpense } from "./actions";
import { CategoryBreakdown, SpendByMonthChart, YearOverYearChart } from "./charts";
import { ExpenseForm } from "./expense-form";
import type { ExpenseCategoryRow, ExpenseLinkOptions, ExpenseRow, RangeKey } from "./queries";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-fy", label: "This FY" },
  { key: "last-fy", label: "Last FY" },
  { key: "last-12", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

type Month = { month: string; total: number; tax: number; count: number; byCategory: Record<string, number> };
type Yoy = { series: { month: string; current: number | null; previous: number }[]; thisFyLabel: string; lastFyLabel: string; ytdNow: number; ytdPrev: number };

const monthName = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

function RangePicker({ active, from, to }: { active: RangeKey; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [custom, setCustom] = useState({ from, to });
  const go = (q: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) sp.set(k, v);
    if (params.get("new")) sp.set("new", "1");
    router.replace(`${pathname}?${sp}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => go({ range: p.key })}
            className={cn("rounded px-2.5 py-1 text-[13px] font-medium text-fg-muted hover:text-fg", active === p.key && "bg-subtle text-fg")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="flex w-full items-center gap-1.5 sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.from && custom.to) go({ from: custom.from, to: custom.to });
        }}
      >
        <Input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={cn("h-8 min-w-0 flex-1 sm:w-36 sm:flex-none", active === "custom" && "border-fg")} />
        <span className="text-fg-muted">–</span>
        <Input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={cn("h-8 min-w-0 flex-1 sm:w-36 sm:flex-none", active === "custom" && "border-fg")} />
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>
    </div>
  );
}

export function ExpensesView({
  rows,
  months,
  yoy,
  range,
  categories,
  vendors,
  linkOptions,
  canWrite,
}: {
  rows: ExpenseRow[];
  months: Month[];
  yoy: Yoy;
  range: { key: RangeKey; from: Date; to: Date };
  categories: ExpenseCategoryRow[];
  vendors: Option[];
  linkOptions: ExpenseLinkOptions;
  canWrite: boolean;
}) {
  const [newOpen, setNewOpen] = useQueryFlag("new");
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const { run } = useActionRunner();

  const total = rows.reduce((s, r) => s + r.total, 0);
  const tax = rows.reduce((s, r) => s + r.taxAmount, 0);
  const activeMonths = months.filter((m) => m.count > 0).length || 1;
  const byCategory = categories
    .map((c) => ({ name: c.name, colorKey: c.colorKey, total: rows.filter((r) => r.category === c.name).reduce((s, r) => s + r.total, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const ytdChange = yoy.ytdPrev ? ((yoy.ytdNow - yoy.ytdPrev) / yoy.ytdPrev) * 100 : null;
  const rangeLabel = range.key === "all" ? "All time" : `${formatDate(range.from)} – ${formatDate(range.to)}`;

  const columns = useMemo<ColumnDef<ExpenseRow, unknown>[]>(
    () => [
      { accessorKey: "date", header: "Date", sortingFn: "datetime", cell: ({ row }) => <span className="whitespace-nowrap tabular">{formatDate(row.original.date)}</span>, meta: { csv: (r) => iso(r.date) } },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-96">
            <p className="flex items-center gap-1.5 truncate font-medium">
              <span className="truncate">{row.original.description}</span>
              {row.original.documents > 0 && <Paperclip className="size-3.5 shrink-0 text-fg-muted" aria-label="Has attachment" />}
            </p>
            {row.original.link && (
              <Link href={row.original.link.href} onClick={(e) => e.stopPropagation()} className="block truncate text-[12.5px] text-fg-muted hover:text-fg hover:underline">
                {row.original.link.label}
              </Link>
            )}
          </div>
        ),
        meta: { csv: (r) => r.description },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="size-2 rounded-full" style={{ background: categoryColor(row.original.categoryKey) }} aria-hidden />
            {row.original.category}
          </span>
        ),
        meta: { csv: (r) => r.category },
      },
      { accessorKey: "vendor", header: "Vendor", cell: ({ getValue }) => <span className="line-clamp-1">{String(getValue() ?? "—")}</span>, meta: { csv: (r) => r.vendor } },
      { accessorKey: "paymentMode", header: "Mode", cell: ({ row }) => (row.original.paymentMode ? PAYMENT_MODE[row.original.paymentMode] : "—"), meta: { csv: (r) => (r.paymentMode ? PAYMENT_MODE[r.paymentMode] : "") } },
      { accessorKey: "transactionRef", header: "Reference", cell: ({ getValue }) => <span className="font-mono text-[12px] text-fg-muted">{String(getValue() ?? "—")}</span>, meta: { csv: (r) => r.transactionRef } },
      { accessorKey: "paidBy", header: "Paid by", meta: { csv: (r) => r.paidBy } },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (row.original.source === "MANUAL" ? <span className="text-fg-muted">Manual</span> : <Badge tone="info">{EXPENSE_SOURCE[row.original.source]}</Badge>),
        meta: { csv: (r) => EXPENSE_SOURCE[r.source] },
      },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatMoney(row.original.amount), meta: { align: "right", label: "Amount (excl. GST)", csv: (r) => r.amount.toFixed(2) } },
      { accessorKey: "taxAmount", header: "GST", cell: ({ row }) => (row.original.taxAmount ? formatMoney(row.original.taxAmount) : "—"), meta: { align: "right", csv: (r) => r.taxAmount.toFixed(2) } },
      { accessorKey: "total", header: "Total", cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.total)}</span>, meta: { align: "right", csv: (r) => r.total.toFixed(2) } },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        meta: { className: "w-12" },
        cell: ({ row }) =>
          canWrite && (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Row actions" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onSelect={() => setEditing(row.original)}>
                    <Pencil /> Edit
                  </MenuItem>
                  <MenuItem danger disabled={row.original.fromPayment} onSelect={() => run(() => archiveExpense({ id: row.original.id }), "Expense archived")}>
                    <Archive /> {row.original.fromPayment ? "Archive (void the payment instead)" : "Archive"}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ),
      },
    ],
    [canWrite, run],
  );

  function exportSummary() {
    const cats = categories.map((c) => c.name);
    downloadCsv(
      `expense-summary-${iso(range.from)}-to-${iso(range.to)}`,
      toCsv(
        ["Month", "Expenses", ...cats, "GST", "Total"],
        months.map((m) => [m.month, m.count, ...cats.map((c) => (m.byCategory[c] ?? 0).toFixed(2)), m.tax.toFixed(2), m.total.toFixed(2)]),
      ),
    );
  }

  const formOpen = (newOpen || !!editing) && canWrite;
  const closeForm = () => {
    setEditing(null);
    if (newOpen) setNewOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="All IT spend in one place — manual entries plus purchases, subscription payments and repairs."
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus />
              New expense
            </Button>
          )
        }
      />
      <RangePicker key={`${iso(range.from)}-${iso(range.to)}`} active={range.key} from={iso(range.from)} to={iso(range.to)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total spend" value={formatMoneyShort(total)} sub={rangeLabel} />
        <StatCard label="Average per month" value={formatMoneyShort(total / activeMonths)} sub={`${activeMonths} month(s) with spend`} />
        <StatCard label="GST paid" value={formatMoneyShort(tax)} sub={`${rows.length} expense(s)`} />
        <StatCard
          label={`${yoy.thisFyLabel} to date`}
          value={formatMoneyShort(yoy.ytdNow)}
          trend={
            ytdChange === null ? null : (
              <Badge tone={ytdChange > 0 ? "warning" : "success"}>
                {ytdChange > 0 ? "+" : ""}
                {ytdChange.toFixed(0)}%
              </Badge>
            )
          }
          sub={`vs ${formatMoneyShort(yoy.ytdPrev)} same point last FY`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly IT spend" description={`By category · ${rangeLabel}`} />
          <CardBody>
            {rows.length ? (
              <SpendByMonthChart data={months} categories={categories} />
            ) : (
              <p className="py-16 text-center text-[13.5px] text-fg-muted">No expenses in this period.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By category" description={rangeLabel} />
          <CardBody>
            <CategoryBreakdown items={byCategory} />
          </CardBody>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses ({rows.length})</TabsTrigger>
          <TabsTrigger value="summary">Monthly summary</TabsTrigger>
          <TabsTrigger value="yoy">Year over year</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder="Search description, vendor, reference…"
            exportName={`expenses-${iso(range.from)}-to-${iso(range.to)}`}
            getRowId={(r) => r.id}
            onRowClick={canWrite ? (r) => setEditing(r) : undefined}
            initialSorting={[{ id: "date", desc: true }]}
            initialHidden={{ transactionRef: false, paidBy: false, amount: false, taxAmount: false, paymentMode: false }}
            pageSize={50}
            filters={[
              { columnId: "category", label: "Category", options: categories.map((c) => ({ value: c.name, label: c.name })) },
              { columnId: "vendor", label: "Vendor", options: [...new Set(rows.map((r) => r.vendor).filter((v): v is string => !!v))].sort().map((v) => ({ value: v, label: v })) },
              { columnId: "paymentMode", label: "Mode", options: toOptions(PAYMENT_MODE) },
              { columnId: "source", label: "Source", options: toOptions(EXPENSE_SOURCE) },
            ]}
            empty={
              <EmptyState
                icon={Wallet}
                title="No expenses in this period"
                description="Pick a wider date range, or record a purchase, repair or service."
                action={canWrite && <Button variant="primary" onClick={() => setNewOpen(true)}>Add expense</Button>}
              />
            }
          />
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader
              title="Monthly summary"
              description="Totals per month and category (this is also the table view of the chart above)."
              action={
                <Button size="sm" variant="ghost" onClick={exportSummary}>
                  Export CSV
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead className="bg-app">
                  <tr className="border-y border-line">
                    {["Month", "Expenses", ...byCategory.map((c) => c.name), "GST", "Total"].map((h, i) => (
                      <th key={h} scope="col" className={cn("h-10 px-4 text-[12px] font-medium tracking-[0.04em] whitespace-nowrap text-fg-muted uppercase", i === 0 ? "text-left" : "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.month} className="h-11 border-b border-line hover:bg-subtle">
                      <td className="px-4 whitespace-nowrap">{monthName(m.month)}</td>
                      <td className="px-4 text-right tabular text-fg-secondary">{m.count}</td>
                      {byCategory.map((c) => (
                        <td key={c.name} className="px-4 text-right tabular text-fg-secondary">
                          {m.byCategory[c.name] ? formatMoney(m.byCategory[c.name]) : "—"}
                        </td>
                      ))}
                      <td className="px-4 text-right tabular text-fg-secondary">{m.tax ? formatMoney(m.tax) : "—"}</td>
                      <td className="px-4 text-right font-medium tabular">{formatMoney(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="h-11 bg-app font-medium">
                    <td className="px-4">Total</td>
                    <td className="px-4 text-right tabular">{rows.length}</td>
                    {byCategory.map((c) => (
                      <td key={c.name} className="px-4 text-right tabular">
                        {formatMoney(c.total)}
                      </td>
                    ))}
                    <td className="px-4 text-right tabular">{formatMoney(tax)}</td>
                    <td className="px-4 text-right tabular">{formatMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="yoy">
          <Card>
            <CardHeader title={`${yoy.thisFyLabel} vs ${yoy.lastFyLabel}`} description="Monthly spend across the Indian financial year (April – March). Not affected by the date filter." />
            <CardBody>
              <YearOverYearChart data={yoy.series} thisLabel={yoy.thisFyLabel} lastLabel={yoy.lastFyLabel} />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      <SlideOver open={formOpen} onOpenChange={(o) => !o && closeForm()} title={editing ? "Edit expense" : "New expense"}>
        {formOpen && (
          <ExpenseForm
            key={editing?.id ?? "new"}
            id={editing?.id}
            initial={editing?.form}
            lockedMoney={editing?.fromPayment}
            categories={categories}
            vendors={vendors}
            linkOptions={linkOptions}
            onDone={closeForm}
          />
        )}
      </SlideOver>
    </div>
  );
}
