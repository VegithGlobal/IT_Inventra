import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { DocumentsView } from "@/features/documents/documents-view";
import { getDocumentLinkOptions, listDocuments } from "@/features/documents/queries";
import { db } from "@/lib/db";
import { canWrite, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices & documents" };

async function Content() {
  const user = await requireUser();
  const [rows, vendors, linkOptions] = await Promise.all([
    listDocuments(),
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getDocumentLinkOptions(),
  ]);
  return <DocumentsView rows={rows} vendors={vendors.map((v) => ({ value: v.id, label: v.name }))} linkOptions={linkOptions} canWrite={canWrite(user.role)} />;
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}
