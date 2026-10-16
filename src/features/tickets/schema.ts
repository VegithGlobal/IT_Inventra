import { z } from "zod";
import { id, optionalDate, optionalFile, optionalId, requiredText, text } from "@/lib/validation";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "WAITING_ON_VENDOR", "RESOLVED", "CLOSED"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TICKET_SOURCES = ["WALK_IN", "PHONE", "WHATSAPP", "EMAIL", "SELF_IDENTIFIED"] as const;
export type TicketStatusKey = (typeof TICKET_STATUSES)[number];

export const DONE_STATUSES: readonly TicketStatusKey[] = ["RESOLVED", "CLOSED"];

const minutes = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 100_000), "Enter minutes as a whole number");

export const ticketSchema = z
  .object({
    title: requiredText("Title", 200),
    requesterId: id("Requester"),
    description: text(8000),
    categoryId: optionalId,
    priority: z.enum(TICKET_PRIORITIES),
    status: z.enum(TICKET_STATUSES),
    source: z.enum(TICKET_SOURCES),
    assetId: optionalId,
    dueDate: optionalDate,
    dueTime: z.string().refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Enter a time like 17:00"),
    timeSpentMinutes: minutes,
    resolutionNotes: text(8000),
  })
  .refine((v) => !v.dueTime || v.dueDate, { path: ["dueDate"], message: "Pick a date for the due time" });

export type TicketInput = z.infer<typeof ticketSchema>;
export const ticketUpdateSchema = z.object({ id: z.string().min(1), data: ticketSchema });

export const statusChangeSchema = z.object({
  id: z.string().min(1),
  status: z.enum(TICKET_STATUSES),
  resolutionNotes: text(8000).optional(),
  addMinutes: minutes.optional(),
});

export const commentSchema = z.object({ ticketId: z.string().min(1), body: requiredText("Comment", 8000) });

export const attachmentSchema = z.object({
  ticketId: z.string().min(1),
  file: optionalFile,
  note: text(500),
});

export const logTimeSchema = z.object({ id: z.string().min(1), minutes: z.number().int().min(-600).max(1440) });
