import "server-only";
import type { Document } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import type { DocumentMetaInput } from "./schema";

const linkInclude = {
  vendor: { select: { id: true, name: true } },
  asset: { select: { id: true, assetTag: true, name: true } },
  subscription: { select: { id: true, name: true } },
  expense: { select: { id: true, description: true } },
  ticket: { select: { id: true, ticketNumber: true, title: true } },
  employee: { select: { id: true, name: true } },
  uploadedBy: { select: { name: true } },
} as const;

/** Plain, client-safe document row (Decimal → number). */
export function toDocumentRow(
  d: Document & {
    vendor?: { id: string; name: string } | null;
    asset?: { id: string; assetTag: string; name: string } | null;
    subscription?: { id: string; name: string } | null;
    expense?: { id: string; description: string } | null;
    ticket?: { id: string; ticketNumber: string; title: string } | null;
    employee?: { id: string; name: string } | null;
    uploadedBy?: { name: string } | null;
  },
) {
  const links: { label: string; href: string }[] = [];
  if (d.asset) links.push({ label: d.asset.assetTag, href: `/assets/${d.asset.id}` });
  if (d.subscription) links.push({ label: d.subscription.name, href: `/subscriptions/${d.subscription.id}` });
  if (d.expense) links.push({ label: d.expense.description, href: `/expenses?focus=${d.expense.id}` });
  if (d.ticket) links.push({ label: d.ticket.ticketNumber, href: `/tickets/${d.ticket.id}` });
  if (d.employee) links.push({ label: d.employee.name, href: `/employees/${d.employee.id}` });
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    invoiceNumber: d.invoiceNumber,
    invoiceDate: d.invoiceDate,
    vendor: d.vendor?.name ?? null,
    amount: d.amount === null ? null : toNumber(d.amount),
    notes: d.notes,
    uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt,
    links,
    form: {
      type: d.type,
      title: d.title,
      invoiceNumber: d.invoiceNumber ?? "",
      invoiceDate: toDateInput(d.invoiceDate),
      vendorId: d.vendorId ?? "",
      amount: d.amount?.toString() ?? "",
      notes: d.notes ?? "",
      assetId: d.assetId ?? "",
      subscriptionId: d.subscriptionId ?? "",
      expenseId: d.expenseId ?? "",
      ticketId: d.ticketId ?? "",
    } satisfies DocumentMetaInput,
  };
}
export type DocumentRow = ReturnType<typeof toDocumentRow>;

export async function listDocuments() {
  const docs = await db.document.findMany({ where: { deletedAt: null }, include: linkInclude, orderBy: { createdAt: "desc" } });
  return docs.map(toDocumentRow);
}

export async function getDocumentsFor(where: { assetId?: string; subscriptionId?: string; expenseId?: string }) {
  const docs = await db.document.findMany({ where: { ...where, deletedAt: null }, include: linkInclude, orderBy: { createdAt: "desc" } });
  return docs.map(toDocumentRow);
}

/** Options for linking a document to an asset/subscription/expense. */
export async function getDocumentLinkOptions() {
  const [assets, subscriptions, expenses] = await Promise.all([
    db.asset.findMany({ where: { deletedAt: null }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, name: true } }),
    db.subscription.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.expense.findMany({ where: { deletedAt: null }, orderBy: { date: "desc" }, take: 300, select: { id: true, description: true, date: true } }),
  ]);
  return {
    assets: assets.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` })),
    subscriptions: subscriptions.map((s) => ({ value: s.id, label: s.name })),
    expenses: expenses.map((e) => ({ value: e.id, label: `${toDateInput(e.date)} · ${e.description}` })),
  };
}
export type DocumentLinkOptions = Awaited<ReturnType<typeof getDocumentLinkOptions>>;
