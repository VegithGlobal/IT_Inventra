"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { parseOptionalDate } from "@/lib/dates";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { toDecimalOrNull } from "@/lib/decimal";
import { orNull } from "@/lib/validation";
import { documentUpdateSchema, uploadSchema, type DocumentMetaInput } from "./schema";

function metaData(v: DocumentMetaInput) {
  return {
    type: v.type,
    title: v.title,
    invoiceNumber: orNull(v.invoiceNumber),
    invoiceDate: parseOptionalDate(v.invoiceDate),
    vendorId: orNull(v.vendorId),
    amount: toDecimalOrNull(v.amount),
    notes: orNull(v.notes),
    assetId: orNull(v.assetId),
    subscriptionId: orNull(v.subscriptionId),
    expenseId: orNull(v.expenseId),
    ticketId: orNull(v.ticketId),
  };
}

export const uploadDocument = createAction({
  schema: uploadSchema,
  handler: async ({ file, ...meta }, { tx, audit, user }) => {
    let stored;
    try {
      stored = await saveUpload(file, "documents");
    } catch (e) {
      if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
      throw e;
    }
    try {
      const doc = await tx.document.create({ data: { ...metaData(meta), ...stored, uploadedById: user.id } });
      await audit({ action: "CREATE", entityType: "Document", entityId: doc.id, entityLabel: doc.title, after: doc });
      return { id: doc.id };
    } catch (e) {
      await storage.delete(stored.fileKey);
      throw e;
    }
  },
});

export const updateDocument = createAction({
  schema: documentUpdateSchema,
  handler: async ({ id, data }, { tx, audit }) => {
    const before = await tx.document.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Document not found.");
    const after = await tx.document.update({ where: { id }, data: metaData(data) });
    await audit({ action: "UPDATE", entityType: "Document", entityId: id, entityLabel: after.title, before, after });
    return { id };
  },
});

/** Soft delete; the file stays in storage so the record can be restored. */
export const archiveDocument = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.document.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Document not found.");
    const after = await tx.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Document", entityId: id, entityLabel: before.title, before, after });
    return { id };
  },
});
