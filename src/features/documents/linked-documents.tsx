import type { Document } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DocumentList, type DocLink } from "./document-ui";
import { toDocumentRow } from "./queries";
import type { DocumentMetaInput } from "./schema";

/** Server wrapper: serialises documents for the client list and loads vendor options. */
export async function LinkedDocuments({
  documents,
  link,
  canWrite,
  defaults,
}: {
  documents: Document[];
  link: DocLink;
  canWrite: boolean;
  defaults?: Partial<DocumentMetaInput>;
}) {
  const vendors = await db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const withVendor = documents.map((d) => ({ ...d, vendor: vendors.find((v) => v.id === d.vendorId) ?? null }));
  return (
    <DocumentList
      docs={withVendor.map(toDocumentRow)}
      vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
      link={link}
      canWrite={canWrite}
      defaults={defaults}
    />
  );
}
