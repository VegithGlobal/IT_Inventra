"use server";

import { z } from "zod";
import { ActionError, createAction } from "@/lib/action";
import { istToUtc } from "@/lib/dates";
import { saveUpload, storage, UploadError } from "@/lib/storage";
import { orNull } from "@/lib/validation";
import { attachmentSchema, commentSchema, logTimeSchema, statusChangeSchema, ticketSchema, ticketUpdateSchema, type TicketInput } from "./schema";
import { createTicketRecord, logStatusChange, statusTimestamps } from "./server";

function toData(v: TicketInput) {
  return {
    title: v.title,
    requesterId: v.requesterId,
    description: orNull(v.description),
    categoryId: orNull(v.categoryId),
    priority: v.priority,
    status: v.status,
    source: v.source,
    assetId: orNull(v.assetId),
    // Date only → end of working day (18:00 IST).
    dueDate: v.dueDate ? istToUtc(v.dueDate, v.dueTime || "18:00") : null,
    timeSpentMinutes: v.timeSpentMinutes ? Number(v.timeSpentMinutes) : 0,
    resolutionNotes: orNull(v.resolutionNotes),
  };
}

export const createTicket = createAction({
  schema: ticketSchema,
  handler: async (input, { tx, audit, user }) => {
    const data = toData(input);
    const ticket = await createTicketRecord(tx, { ...data, ...statusTimestamps({ status: "OPEN", resolvedAt: null, closedAt: null }, data.status), createdById: user.id, assigneeId: user.id });
    await audit({ action: "CREATE", entityType: "Ticket", entityId: ticket.id, entityLabel: `${ticket.ticketNumber} · ${ticket.title}`, after: ticket });
    return { id: ticket.id, ticketNumber: ticket.ticketNumber };
  },
});

export const updateTicket = createAction({
  schema: ticketUpdateSchema,
  handler: async ({ id, data }, { tx, audit, user }) => {
    const before = await tx.ticket.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Ticket not found.");
    const next = toData(data);
    const after = await tx.ticket.update({ where: { id }, data: { ...next, ...statusTimestamps(before, next.status) } });
    await logStatusChange(tx, id, user.id, before.status, after.status);
    await audit({ action: "UPDATE", entityType: "Ticket", entityId: id, entityLabel: after.ticketNumber, before, after });
    return { id };
  },
});

/** Kanban drops, the status menu and "Resolve" all come through here. */
export const changeTicketStatus = createAction({
  schema: statusChangeSchema,
  handler: async ({ id, status, resolutionNotes, addMinutes }, { tx, audit, user }) => {
    const before = await tx.ticket.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Ticket not found.");
    const after = await tx.ticket.update({
      where: { id },
      data: {
        status,
        ...statusTimestamps(before, status),
        ...(resolutionNotes ? { resolutionNotes } : {}),
        ...(addMinutes ? { timeSpentMinutes: before.timeSpentMinutes + Number(addMinutes) } : {}),
      },
    });
    await logStatusChange(tx, id, user.id, before.status, status);
    if (resolutionNotes) await tx.ticketComment.create({ data: { ticketId: id, authorId: user.id, kind: "COMMENT", body: `Resolution: ${resolutionNotes}` } });
    await audit({ action: "UPDATE", entityType: "Ticket", entityId: id, entityLabel: after.ticketNumber, before, after });
    return { id, status };
  },
});

export const addTicketComment = createAction({
  schema: commentSchema,
  handler: async ({ ticketId, body }, { tx, audit, user }) => {
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
    if (!ticket) throw new ActionError("Ticket not found.");
    const comment = await tx.ticketComment.create({ data: { ticketId, authorId: user.id, kind: "COMMENT", body } });
    // Touch updatedAt so "recently active" sorting reflects the comment.
    await tx.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
    await audit({ action: "CREATE", entityType: "TicketComment", entityId: comment.id, entityLabel: `${ticket.ticketNumber} comment`, after: comment });
    return { id: comment.id };
  },
});

export const addTicketAttachment = createAction({
  schema: attachmentSchema,
  handler: async ({ ticketId, file, note }, { tx, audit, user }) => {
    if (!file) throw new ActionError("Choose a file to attach.", { file: "Choose a file" });
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
    if (!ticket) throw new ActionError("Ticket not found.");
    let stored;
    try {
      stored = await saveUpload(file, "documents");
    } catch (e) {
      if (e instanceof UploadError) throw new ActionError(e.message, { file: e.message });
      throw e;
    }
    try {
      const doc = await tx.document.create({
        data: { type: file.type.startsWith("image/") ? "PHOTO" : "OTHER", title: note || file.name, ...stored, ticketId, assetId: ticket.assetId, uploadedById: user.id },
      });
      await tx.ticketComment.create({ data: { ticketId, authorId: user.id, kind: "ATTACHMENT", body: doc.title, meta: { documentId: doc.id, mimeType: doc.mimeType } } });
      await audit({ action: "CREATE", entityType: "Document", entityId: doc.id, entityLabel: `${ticket.ticketNumber} · ${doc.title}`, after: doc });
      return { id: doc.id };
    } catch (e) {
      await storage.delete(stored.fileKey);
      throw e;
    }
  },
});

export const logTicketTime = createAction({
  schema: logTimeSchema,
  handler: async ({ id, minutes }, { tx, audit }) => {
    const before = await tx.ticket.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Ticket not found.");
    const after = await tx.ticket.update({ where: { id }, data: { timeSpentMinutes: Math.max(0, before.timeSpentMinutes + minutes) } });
    await audit({ action: "UPDATE", entityType: "Ticket", entityId: id, entityLabel: after.ticketNumber, before, after });
    return { minutes: after.timeSpentMinutes };
  },
});

export const archiveTicket = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.ticket.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Ticket not found.");
    const after = await tx.ticket.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit({ action: "DELETE", entityType: "Ticket", entityId: id, entityLabel: `${before.ticketNumber} · ${before.title}`, before, after });
    return { id };
  },
});
