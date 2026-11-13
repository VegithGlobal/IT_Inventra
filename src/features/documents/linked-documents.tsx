import type { Document } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DocumentList, type DocLink } from "./document-ui";
import { toDocumentRow } from "./queries";
import type { DocumentMetaInput } from "./schema";

/** Server wrapper: serialises documents for the client list and loads vendor (and, on asset pages, asset) options. */
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
  const [vendors, links, assets] = await Promise.all([
    db.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.document.findMany({
      where: { id: { in: documents.map((d) => d.id) } },
      select: { id: true, assets: { select: { id: true, assetTag: true, name: true }, orderBy: { assetTag: "asc" } } },
    }),
    // An invoice uploaded from one asset often covers others too, so asset pages can pick more.
    link.assetId ? db.asset.findMany({ where: { deletedAt: null }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, name: true } }) : null,
  ]);
  const rows = documents.map((d) => ({
    ...d,
    vendor: vendors.find((v) => v.id === d.vendorId) ?? null,
    assets: links.find((l) => l.id === d.id)?.assets ?? [],
  }));
  return (
    <DocumentList
      docs={rows.map(toDocumentRow)}
      assetOptions={assets?.map((a) => ({ value: a.id, label: `${a.assetTag} · ${a.name}` }))}
      vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
      link={link}
      canWrite={canWrite}
      defaults={defaults}
    />
  );
}
