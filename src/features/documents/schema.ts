import { z } from "zod";
import { optionalDate, optionalId, optionalMoney, requiredText, text } from "@/lib/validation";

export const DOCUMENT_TYPES = ["INVOICE", "RECEIPT", "WARRANTY_CARD", "QUOTATION", "HANDOVER_FORM", "RETURN_FORM", "CONTRACT", "PHOTO", "OTHER"] as const;

export const documentMetaSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: requiredText("Title", 200),
  invoiceNumber: text(80),
  invoiceDate: optionalDate,
  vendorId: optionalId,
  amount: optionalMoney,
  notes: text(2000),
  assetId: optionalId,
  subscriptionId: optionalId,
  expenseId: optionalId,
  ticketId: optionalId,
});
export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;

export const uploadSchema = documentMetaSchema.extend({
  file: z.instanceof(File, { message: "Choose a file to upload" }).refine((f) => f.size > 0, "Choose a file to upload"),
});

export const documentUpdateSchema = z.object({ id: z.string().min(1), data: documentMetaSchema });

export const ACCEPTED_UPLOADS = "application/pdf,image/jpeg,image/png,image/webp";
