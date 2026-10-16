import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import type { Tx } from "@/lib/db";

/**
 * Creates a ticket and stamps its number from the DB sequence (TKT-0021…). The placeholder keeps
 * the unique constraint happy for the instant before the sequence value is known.
 */
export async function createTicketRecord(tx: Tx, data: Omit<Prisma.TicketUncheckedCreateInput, "ticketNumber" | "seq">, systemNote?: string) {
  const draft = await tx.ticket.create({ data: { ...data, ticketNumber: `TMP-${randomUUID()}` } });
  const ticket = await tx.ticket.update({ where: { id: draft.id }, data: { ticketNumber: `TKT-${String(draft.seq).padStart(4, "0")}` } });
  await tx.ticketComment.create({
    data: { ticketId: ticket.id, authorId: data.createdById ?? null, kind: "SYSTEM", body: systemNote ?? "Ticket created" },
  });
  return ticket;
}

/** Timestamps that follow from a status: resolvedAt/closedAt are set on entry and cleared on reopen. */
export function statusTimestamps(from: { status: TicketStatus; resolvedAt: Date | null; closedAt: Date | null }, to: TicketStatus) {
  const now = new Date();
  const done = to === "RESOLVED" || to === "CLOSED";
  return {
    resolvedAt: done ? (from.resolvedAt ?? now) : null,
    closedAt: to === "CLOSED" ? (from.closedAt ?? now) : null,
  };
}

export async function logStatusChange(tx: Tx, ticketId: string, authorId: string | null, from: TicketStatus, to: TicketStatus) {
  if (from === to) return;
  await tx.ticketComment.create({ data: { ticketId, authorId, kind: "STATUS_CHANGE", body: "Status changed", meta: { from, to } } });
}
