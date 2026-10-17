import "server-only";
import { db } from "@/lib/db";
import { dueDatesBetween } from "@/lib/billing";
import { addDays, addMonths, daysBetween, HOUR_MS, istDateOf, monthKey, parseDateInput, startOfMonth, toDateInput, today } from "@/lib/dates";
import { bookValue } from "@/lib/depreciation";
import { formatMoney, toNumber } from "@/lib/format";
import { ASSET_CONDITION, ASSET_STATUS, BILLING_CYCLE, LICENSE_TYPE, PAYMENT_MODE, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/options";
import { fyStart } from "@/features/expenses/queries";
import type { ReportMeta, ReportParams, ReportResult, ReportRow } from "./types";

type Definition = ReportMeta & { defaults: () => Partial<ReportParams>; run: (p: ReportParams) => Promise<ReportResult> };

const iso = (d: Date) => toDateInput(d);
const monthName = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
const range = (p: ReportParams) => ({ gte: parseDateInput(p.from), lte: parseDateInput(p.to) });
const sum = (rows: ReportRow[], key: string) => rows.reduce((s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0), 0);

const DEFS: Definition[] = [
  // ─── Assets ────────────────────────────────────────────────────────────────
  {
    key: "asset-register",
    title: "Asset register",
    description: "Every asset with its holder, location, cost and current book value.",
    section: "Assets",
    params: { dateRange: { label: "Purchased" } },
    defaults: () => ({ from: "2000-01-01", to: iso(today()) }),
    async run(p) {
      const assets = await db.asset.findMany({
        where: { deletedAt: null, OR: [{ purchaseDate: range(p) }, ...(p.from <= "2000-01-01" ? [{ purchaseDate: null }] : [])] },
        orderBy: { assetTag: "asc" },
        include: { type: true, currentHolder: { select: { name: true } }, location: { select: { name: true } }, department: { select: { name: true } }, vendor: { select: { name: true } } },
      });
      const rows = assets.map((a) => ({
        tag: a.assetTag,
        href: `/assets/${a.id}`,
        name: a.name,
        type: a.type.name,
        serial: a.serialNumber,
        status: ASSET_STATUS[a.status].label,
        condition: ASSET_CONDITION[a.condition].label,
        holder: a.currentHolder?.name ?? null,
        location: a.location?.name ?? null,
        department: a.department?.name ?? null,
        vendor: a.vendor?.name ?? null,
        purchased: a.purchaseDate,
        warrantyEnd: a.warrantyEnd,
        cost: a.purchaseCost ? toNumber(a.purchaseCost) : null,
        book: a.purchaseCost ? bookValue({ cost: a.purchaseCost, purchaseDate: a.purchaseDate, usefulLifeMonths: a.type.usefulLifeMonths, salvagePercent: a.type.salvagePercent }).bookValue : null,
      }));
      return {
        summary: `${rows.length} assets · ${formatMoney(sum(rows, "cost"))} cost · ${formatMoney(sum(rows, "book"))} book value`,
        columns: [
          { key: "tag", label: "Tag", type: "text", hrefKey: "href" },
          { key: "name", label: "Asset", type: "text" },
          { key: "type", label: "Type", type: "text" },
          { key: "serial", label: "Serial", type: "text", hidden: true },
          { key: "status", label: "Status", type: "text" },
          { key: "condition", label: "Condition", type: "text", hidden: true },
          { key: "holder", label: "Assigned to", type: "text" },
          { key: "location", label: "Location", type: "text" },
          { key: "department", label: "Department", type: "text", hidden: true },
          { key: "vendor", label: "Vendor", type: "text", hidden: true },
          { key: "purchased", label: "Purchased", type: "date" },
          { key: "warrantyEnd", label: "Warranty end", type: "date", hidden: true },
          { key: "cost", label: "Cost", type: "money", total: true },
          { key: "book", label: "Book value", type: "money", total: true },
        ],
        rows,
      };
    },
  },
  {
    key: "assets-by",
    title: "Assets by employee, department or location",
    description: "Counts and value of assets grouped the way you need.",
    section: "Assets",
    params: { groups: [
      { value: "employee", label: "Employee" },
      { value: "department", label: "Department" },
      { value: "location", label: "Location" },
      { value: "type", label: "Asset type" },
      { value: "status", label: "Status" },
    ] },
    defaults: () => ({ group: "employee" }),
    async run(p) {
      const assets = await db.asset.findMany({
        where: { deletedAt: null },
        include: { type: true, currentHolder: { select: { id: true, name: true } }, location: { select: { name: true } }, department: { select: { name: true } } },
      });
      const keyOf = (a: (typeof assets)[number]) =>
        p.group === "department" ? a.department?.name : p.group === "location" ? a.location?.name : p.group === "type" ? a.type.name : p.group === "status" ? ASSET_STATUS[a.status].label : a.currentHolder?.name;
      const groups = new Map<string, { name: string; href: string | null; count: number; assigned: number; cost: number; book: number; tags: string[] }>();
      for (const a of assets) {
        const name = keyOf(a) ?? (p.group === "employee" ? "Unassigned" : "Not set");
        const g = groups.get(name) ?? { name, href: p.group === "employee" && a.currentHolder ? `/employees/${a.currentHolder.id}` : null, count: 0, assigned: 0, cost: 0, book: 0, tags: [] };
        g.count++;
        if (a.status === "ASSIGNED") g.assigned++;
        g.cost += toNumber(a.purchaseCost);
        g.book += a.purchaseCost ? bookValue({ cost: a.purchaseCost, purchaseDate: a.purchaseDate, usefulLifeMonths: a.type.usefulLifeMonths, salvagePercent: a.type.salvagePercent }).bookValue : 0;
        g.tags.push(a.assetTag);
        groups.set(name, g);
      }
      const rows = [...groups.values()].sort((a, b) => b.cost - a.cost).map((g) => ({ ...g, tags: g.tags.sort().join(", ") }));
      const label = p.group === "employee" ? "Employee" : p.group === "department" ? "Department" : p.group === "location" ? "Location" : p.group === "type" ? "Type" : "Status";
      return {
        summary: `${rows.length} groups · ${assets.length} assets`,
        columns: [
          { key: "name", label, type: "text", hrefKey: "href" },
          { key: "count", label: "Assets", type: "number", total: true },
          { key: "assigned", label: "Assigned", type: "number", total: true, hidden: p.group === "employee" },
          { key: "tags", label: "Tags", type: "text" },
          { key: "cost", label: "Cost", type: "money", total: true },
          { key: "book", label: "Book value", type: "money", total: true },
        ],
        rows,
      };
    },
  },
  {
    key: "assignment-history",
    title: "Assignment history",
    description: "Every check-out and check-in in a period, with duration and condition.",
    section: "Assets",
    params: { dateRange: { label: "Issued" } },
    defaults: () => ({ from: iso(addMonths(today(), -12)), to: iso(today()) }),
    async run(p) {
      const t = today();
      const list = await db.assetAssignment.findMany({
        where: { issuedAt: range(p), asset: { deletedAt: null } },
        orderBy: { issuedAt: "desc" },
        include: { asset: { select: { id: true, assetTag: true, name: true } }, employee: { select: { name: true, department: { select: { name: true } } } } },
      });
      const rows = list.map((a) => ({
        tag: a.asset.assetTag,
        href: `/assets/${a.asset.id}`,
        asset: a.asset.name,
        employee: a.employee.name,
        department: a.employee.department?.name ?? null,
        issued: a.issuedAt,
        returned: a.returnedAt,
        days: daysBetween(a.issuedAt, a.returnedAt ?? t),
        conditionOut: ASSET_CONDITION[a.conditionAtIssue].label,
        conditionIn: a.conditionAtReturn ? ASSET_CONDITION[a.conditionAtReturn].label : null,
        damage: a.damageNotes,
      }));
      return {
        summary: `${rows.length} assignments · ${rows.filter((r) => !r.returned).length} still out`,
        columns: [
          { key: "tag", label: "Tag", type: "text", hrefKey: "href" },
          { key: "asset", label: "Asset", type: "text" },
          { key: "employee", label: "Employee", type: "text" },
          { key: "department", label: "Department", type: "text", hidden: true },
          { key: "issued", label: "Issued", type: "date" },
          { key: "returned", label: "Returned", type: "date" },
          { key: "days", label: "Days", type: "number" },
          { key: "conditionOut", label: "Out", type: "text" },
          { key: "conditionIn", label: "Back", type: "text" },
          { key: "damage", label: "Damage notes", type: "text", hidden: true },
        ],
        rows,
      };
    },
  },
  {
    key: "depreciation",
    title: "Depreciation",
    description: "Straight-line depreciation and book value of every asset as of a date.",
    section: "Assets",
    params: { asOf: true },
    defaults: () => ({ asOf: iso(today()) }),
    async run(p) {
      const asOf = parseDateInput(p.asOf);
      const assets = await db.asset.findMany({
        where: { deletedAt: null, purchaseCost: { not: null }, purchaseDate: { lte: asOf } },
        orderBy: { assetTag: "asc" },
        include: { type: true },
      });
      const rows = assets.map((a) => {
        const d = bookValue({ cost: a.purchaseCost, purchaseDate: a.purchaseDate, usefulLifeMonths: a.type.usefulLifeMonths, salvagePercent: a.type.salvagePercent, asOf });
        const cost = toNumber(a.purchaseCost);
        return {
          tag: a.assetTag,
          href: `/assets/${a.id}`,
          asset: a.name,
          type: a.type.name,
          purchased: a.purchaseDate,
          cost,
          life: a.type.usefulLifeMonths,
          salvage: (cost * toNumber(a.type.salvagePercent)) / 100,
          months: d.monthsElapsed,
          depreciated: d.depreciated,
          book: d.bookValue,
          pct: cost ? d.depreciated / cost : 0,
          status: d.fullyDepreciated ? "Fully depreciated" : "Depreciating",
        };
      });
      return {
        summary: `As of ${p.asOf} · ${formatMoney(sum(rows, "cost"))} cost → ${formatMoney(sum(rows, "book"))} book value`,
        columns: [
          { key: "tag", label: "Tag", type: "text", hrefKey: "href" },
          { key: "asset", label: "Asset", type: "text" },
          { key: "type", label: "Type", type: "text" },
          { key: "purchased", label: "Purchased", type: "date" },
          { key: "life", label: "Life (months)", type: "number", hidden: true },
          { key: "months", label: "Months used", type: "number" },
          { key: "cost", label: "Cost", type: "money", total: true },
          { key: "salvage", label: "Salvage", type: "money", total: true, hidden: true },
          { key: "depreciated", label: "Depreciated", type: "money", total: true },
          { key: "pct", label: "% used", type: "percent" },
          { key: "book", label: "Book value", type: "money", total: true },
          { key: "status", label: "State", type: "text", hidden: true },
        ],
        rows,
      };
    },
  },
  {
    key: "warranty-expiry",
    title: "Warranty expiry",
    description: "Assets whose warranty ends in a period — plan renewals or replacements.",
    section: "Assets",
    params: { dateRange: { label: "Warranty ends" } },
    defaults: () => ({ from: iso(today()), to: iso(addDays(today(), 90)) }),
    async run(p) {
      const t = today();
      const assets = await db.asset.findMany({
        where: { deletedAt: null, status: { notIn: ["DISPOSED", "RETIRED"] }, warrantyEnd: range(p) },
        orderBy: { warrantyEnd: "asc" },
        include: { type: true, currentHolder: { select: { name: true } }, vendor: { select: { name: true } } },
      });
      const rows = assets.map((a) => ({
        tag: a.assetTag,
        href: `/assets/${a.id}`,
        asset: a.name,
        type: a.type.name,
        holder: a.currentHolder?.name ?? null,
        vendor: a.vendor?.name ?? null,
        ends: a.warrantyEnd,
        days: daysBetween(t, a.warrantyEnd!),
        cost: a.purchaseCost ? toNumber(a.purchaseCost) : null,
      }));
      return {
        summary: `${rows.length} warranties end between ${p.from} and ${p.to}`,
        columns: [
          { key: "tag", label: "Tag", type: "text", hrefKey: "href" },
          { key: "asset", label: "Asset", type: "text" },
          { key: "type", label: "Type", type: "text" },
          { key: "holder", label: "Assigned to", type: "text" },
          { key: "vendor", label: "Vendor", type: "text" },
          { key: "ends", label: "Warranty ends", type: "date" },
          { key: "days", label: "Days left", type: "number" },
          { key: "cost", label: "Cost", type: "money", total: true },
        ],
        rows,
      };
    },
  },
  {
    key: "low-stock",
    title: "Low stock",
    description: "Items at or below their reorder point, with a suggested order quantity.",
    section: "Assets",
    params: {},
    defaults: () => ({}),
    async run() {
      const items = await db.inventoryItem.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, include: { vendor: { select: { name: true } }, location: { select: { name: true } } } });
      const rows = items
        .filter((i) => i.quantity <= i.minQuantity)
        .map((i) => {
          // Restock to twice the reorder point (at least 1).
          const order = Math.max(1, i.minQuantity * 2 - i.quantity);
          const unit = i.unitCost ? toNumber(i.unitCost) : null;
          return { name: i.name, href: `/inventory/${i.id}`, sku: i.sku, category: i.category, onHand: i.quantity, reorderAt: i.minQuantity, order, unitCost: unit, orderCost: unit === null ? null : unit * order, vendor: i.vendor?.name ?? null, location: i.location?.name ?? null };
        });
      return {
        summary: `${rows.length} item(s) to reorder · ≈ ${formatMoney(sum(rows, "orderCost"))}`,
        columns: [
          { key: "name", label: "Item", type: "text", hrefKey: "href" },
          { key: "sku", label: "SKU", type: "text" },
          { key: "category", label: "Category", type: "text", hidden: true },
          { key: "onHand", label: "On hand", type: "number" },
          { key: "reorderAt", label: "Reorder at", type: "number" },
          { key: "order", label: "Suggested order", type: "number", total: true },
          { key: "unitCost", label: "Unit cost", type: "money" },
          { key: "orderCost", label: "Order cost", type: "money", total: true },
          { key: "vendor", label: "Vendor", type: "text" },
          { key: "location", label: "Location", type: "text", hidden: true },
        ],
        rows,
      };
    },
  },
  {
    key: "license-usage",
    title: "License usage",
    description: "Seats used and free per license, cost per seat and expiry.",
    section: "Assets",
    params: {},
    defaults: () => ({}),
    async run() {
      const licenses = await db.license.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: { vendor: { select: { name: true } }, _count: { select: { seats: { where: { revokedAt: null } } } } },
      });
      const rows = licenses.map((l) => {
        const cost = l.cost ? toNumber(l.cost) : null;
        return {
          name: l.name,
          href: `/licenses/${l.id}`,
          type: LICENSE_TYPE[l.type],
          vendor: l.vendor?.name ?? null,
          total: l.totalSeats,
          used: l._count.seats,
          free: l.type === "SITE" ? null : Math.max(0, l.totalSeats - l._count.seats),
          utilisation: l.type === "SITE" ? null : l._count.seats / Math.max(1, l.totalSeats),
          expires: l.expiryDate,
          cost,
          perSeat: cost !== null && l.totalSeats ? cost / l.totalSeats : null,
        };
      });
      return {
        summary: `${rows.length} licenses · ${sum(rows, "used")} of ${sum(rows, "total")} seats in use`,
        columns: [
          { key: "name", label: "License", type: "text", hrefKey: "href" },
          { key: "type", label: "Type", type: "text" },
          { key: "vendor", label: "Vendor", type: "text", hidden: true },
          { key: "used", label: "Used", type: "number", total: true },
          { key: "total", label: "Seats", type: "number", total: true },
          { key: "free", label: "Free", type: "number", total: true },
          { key: "utilisation", label: "Utilisation", type: "percent" },
          { key: "expires", label: "Expires", type: "date" },
          { key: "cost", label: "Cost", type: "money", total: true },
          { key: "perSeat", label: "Per seat", type: "money" },
        ],
        rows,
      };
    },
  },

  // ─── Finance ───────────────────────────────────────────────────────────────
  {
    key: "expenses",
    title: "Expense report",
    description: "IT spend for any period — itemised, or by category, vendor or month.",
    section: "Finance",
    params: {
      dateRange: { label: "Date" },
      groups: [
        { value: "category", label: "Category" },
        { value: "vendor", label: "Vendor" },
        { value: "month", label: "Month" },
        { value: "none", label: "Itemised" },
      ],
    },
    defaults: () => ({ from: iso(fyStart(today())), to: iso(today()), group: "category" }),
    async run(p) {
      const list = await db.expense.findMany({
        where: { deletedAt: null, date: range(p) },
        orderBy: { date: "desc" },
        include: { category: { select: { name: true } }, vendor: { select: { name: true } } },
      });
      const total = list.reduce((s, e) => s + toNumber(e.total), 0);
      if (p.group === "none") {
        const rows = list.map((e) => ({
          date: e.date,
          description: e.description,
          category: e.category.name,
          vendor: e.vendor?.name ?? null,
          mode: e.paymentMode ? PAYMENT_MODE[e.paymentMode] : null,
          reference: e.transactionRef,
          amount: toNumber(e.amount),
          tax: toNumber(e.taxAmount),
          total: toNumber(e.total),
        }));
        return {
          summary: `${rows.length} expenses · ${formatMoney(total)}`,
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "description", label: "Description", type: "text" },
            { key: "category", label: "Category", type: "text" },
            { key: "vendor", label: "Vendor", type: "text" },
            { key: "mode", label: "Mode", type: "text", hidden: true },
            { key: "reference", label: "Reference", type: "text", hidden: true },
            { key: "amount", label: "Amount", type: "money", total: true },
            { key: "tax", label: "GST", type: "money", total: true },
            { key: "total", label: "Total", type: "money", total: true },
          ],
          rows,
        };
      }
      const keyOf = (e: (typeof list)[number]) => (p.group === "vendor" ? (e.vendor?.name ?? "No vendor") : p.group === "month" ? monthKey(e.date) : e.category.name);
      const groups = new Map<string, { name: string; count: number; amount: number; tax: number; total: number }>();
      for (const e of list) {
        const k = keyOf(e);
        const g = groups.get(k) ?? { name: p.group === "month" ? monthName(k) : k, count: 0, amount: 0, tax: 0, total: 0 };
        g.count++;
        g.amount += toNumber(e.amount);
        g.tax += toNumber(e.taxAmount);
        g.total += toNumber(e.total);
        groups.set(k, g);
      }
      const rows = [...groups.entries()]
        .sort((a, b) => (p.group === "month" ? a[0].localeCompare(b[0]) : b[1].total - a[1].total))
        .map(([, g]) => ({ ...g, share: total ? g.total / total : 0 }));
      return {
        summary: `${list.length} expenses · ${formatMoney(total)}`,
        columns: [
          { key: "name", label: p.group === "vendor" ? "Vendor" : p.group === "month" ? "Month" : "Category", type: "text" },
          { key: "count", label: "Expenses", type: "number", total: true },
          { key: "amount", label: "Amount", type: "money", total: true },
          { key: "tax", label: "GST", type: "money", total: true },
          { key: "total", label: "Total", type: "money", total: true },
          { key: "share", label: "Share", type: "percent" },
        ],
        rows,
      };
    },
  },
  {
    key: "renewals",
    title: "Upcoming renewals",
    description: "Every subscription payment falling due in a period, including repeats.",
    section: "Finance",
    params: { dateRange: { label: "Due" } },
    defaults: () => ({ from: iso(today()), to: iso(addDays(today(), 90)) }),
    async run(p) {
      const from = parseDateInput(p.from);
      const to = parseDateInput(p.to);
      const t = today();
      const subs = await db.subscription.findMany({ where: { deletedAt: null, status: "ACTIVE" }, include: { vendor: { select: { name: true } } } });
      const rows: ReportRow[] = [];
      for (const s of subs) {
        // Unpaid overdue dates count too if they're inside the range.
        const start = s.nextDueDate < from ? from : s.nextDueDate;
        for (const d of dueDatesBetween(s.nextDueDate, s.billingCycle, s.customCycleDays, start, to)) {
          rows.push({
            due: d,
            name: s.name,
            href: `/subscriptions/${s.id}`,
            vendor: s.vendor?.name ?? null,
            cycle: s.billingCycle === "CUSTOM" ? `Every ${s.customCycleDays} days` : BILLING_CYCLE[s.billingCycle],
            autoRenew: s.autoRenew ? "Yes" : "No",
            state: d < t ? "Overdue" : daysBetween(t, d) <= 7 ? "This week" : "",
            amount: toNumber(s.amount),
          });
        }
      }
      rows.sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime());
      return {
        summary: `${rows.length} payment(s) · ${formatMoney(sum(rows, "amount"))}`,
        columns: [
          { key: "due", label: "Due", type: "date" },
          { key: "name", label: "Service", type: "text", hrefKey: "href" },
          { key: "vendor", label: "Provider", type: "text" },
          { key: "cycle", label: "Cycle", type: "text" },
          { key: "autoRenew", label: "Auto-renew", type: "text", hidden: true },
          { key: "state", label: "", type: "text" },
          { key: "amount", label: "Amount", type: "money", total: true },
        ],
        rows,
      };
    },
  },

  // ─── Work ──────────────────────────────────────────────────────────────────
  {
    key: "ticket-summary",
    title: "Ticket summary",
    description: "Tickets opened in a period — counts, resolution time and time spent.",
    section: "Work",
    params: {
      dateRange: { label: "Opened" },
      groups: [
        { value: "category", label: "Category" },
        { value: "status", label: "Status" },
        { value: "priority", label: "Priority" },
        { value: "requester", label: "Requester" },
        { value: "month", label: "Month" },
        { value: "none", label: "Itemised" },
      ],
    },
    defaults: () => ({ from: iso(startOfMonth(addMonths(today(), -2))), to: iso(today()), group: "category" }),
    async run(p) {
      const from = parseDateInput(p.from);
      const toEnd = new Date(parseDateInput(p.to).getTime() + 24 * HOUR_MS);
      const list = await db.ticket.findMany({
        where: { deletedAt: null, createdAt: { gte: new Date(from.getTime() - 5.5 * HOUR_MS), lt: new Date(toEnd.getTime() - 5.5 * HOUR_MS) } },
        orderBy: { seq: "desc" },
        include: { category: { select: { name: true } }, requester: { select: { name: true } }, asset: { select: { assetTag: true } } },
      });
      const hoursToResolve = (t: (typeof list)[number]) => (t.resolvedAt ? (t.resolvedAt.getTime() - t.createdAt.getTime()) / HOUR_MS : null);
      if (p.group === "none") {
        const rows = list.map((t) => ({
          number: t.ticketNumber,
          href: `/tickets/${t.id}`,
          title: t.title,
          requester: t.requester.name,
          category: t.category?.name ?? null,
          priority: TICKET_PRIORITY[t.priority],
          status: TICKET_STATUS[t.status].label,
          asset: t.asset?.assetTag ?? null,
          opened: t.createdAt,
          resolved: t.resolvedAt,
          hours: hoursToResolve(t),
          minutes: t.timeSpentMinutes,
        }));
        return {
          summary: `${rows.length} tickets`,
          columns: [
            { key: "number", label: "Ticket", type: "text", hrefKey: "href" },
            { key: "title", label: "Title", type: "text" },
            { key: "requester", label: "Requester", type: "text" },
            { key: "category", label: "Category", type: "text" },
            { key: "priority", label: "Priority", type: "text" },
            { key: "status", label: "Status", type: "text" },
            { key: "asset", label: "Asset", type: "text", hidden: true },
            { key: "opened", label: "Opened", type: "datetime" },
            { key: "resolved", label: "Resolved", type: "datetime", hidden: true },
            { key: "hours", label: "Hours to resolve", type: "number" },
            { key: "minutes", label: "Minutes spent", type: "number", total: true },
          ],
          rows,
        };
      }
      const keyOf = (t: (typeof list)[number]) =>
        p.group === "status" ? TICKET_STATUS[t.status].label : p.group === "priority" ? TICKET_PRIORITY[t.priority] : p.group === "requester" ? t.requester.name : p.group === "month" ? monthKey(istDateOf(t.createdAt)) : (t.category?.name ?? "Uncategorised");
      const groups = new Map<string, { name: string; count: number; open: number; resolved: number; hours: number[]; minutes: number }>();
      for (const t of list) {
        const k = keyOf(t);
        const g = groups.get(k) ?? { name: p.group === "month" ? monthName(k) : k, count: 0, open: 0, resolved: 0, hours: [], minutes: 0 };
        g.count++;
        if (t.status === "RESOLVED" || t.status === "CLOSED") g.resolved++;
        else g.open++;
        const h = hoursToResolve(t);
        if (h !== null) g.hours.push(h);
        g.minutes += t.timeSpentMinutes;
        groups.set(k, g);
      }
      const rows = [...groups.entries()]
        .sort((a, b) => (p.group === "month" ? a[0].localeCompare(b[0]) : b[1].count - a[1].count))
        .map(([, g]) => ({ name: g.name, count: g.count, open: g.open, resolved: g.resolved, avgHours: g.hours.length ? g.hours.reduce((s, x) => s + x, 0) / g.hours.length : null, minutes: g.minutes }));
      return {
        summary: `${list.length} tickets · ${list.filter((t) => t.resolvedAt).length} resolved`,
        columns: [
          { key: "name", label: { category: "Category", status: "Status", priority: "Priority", requester: "Requester", month: "Month" }[p.group] ?? "Group", type: "text" },
          { key: "count", label: "Tickets", type: "number", total: true },
          { key: "open", label: "Open", type: "number", total: true },
          { key: "resolved", label: "Resolved", type: "number", total: true },
          { key: "avgHours", label: "Avg. hours to resolve", type: "number" },
          { key: "minutes", label: "Minutes spent", type: "number", total: true },
        ],
        rows,
      };
    },
  },
];

export const REPORTS: ReportMeta[] = DEFS.map(({ key, title, description, section, params }) => ({ key, title, description, section, params }));

export function getReportDef(key: string) {
  return DEFS.find((d) => d.key === key) ?? null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** URL params → validated report params, falling back to the report's defaults. */
export function resolveParams(def: Definition, sp: Record<string, string | string[] | undefined>): ReportParams {
  const d = def.defaults();
  const pick = (k: keyof ReportParams) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const from = pick("from") && DATE_RE.test(pick("from")!) ? pick("from")! : (d.from ?? "");
  const to = pick("to") && DATE_RE.test(pick("to")!) ? pick("to")! : (d.to ?? "");
  const group = def.params.groups?.some((g) => g.value === pick("group")) ? pick("group")! : (d.group ?? def.params.groups?.[0]?.value ?? "");
  const asOf = pick("asOf") && DATE_RE.test(pick("asOf")!) ? pick("asOf")! : (d.asOf ?? "");
  return from && to && from > to ? { from: to, to: from, group, asOf } : { from, to, group, asOf };
}
