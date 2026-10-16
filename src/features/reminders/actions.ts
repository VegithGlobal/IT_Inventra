"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ActionError, createAction, type ActionResult } from "@/lib/action";
import { istToUtc } from "@/lib/dates";
import { orNull } from "@/lib/validation";
import { getCurrentUser, WRITE_ROLES } from "@/lib/session";
import { runReminders, type RunSummary } from "@/features/notifications/engine";
import { Prisma } from "@/generated/prisma/client";
import { reminderSaveSchema, type ReminderInput, type TicketTemplate } from "./schema";

const toData = (v: ReminderInput) => ({
  title: v.title,
  type: v.type,
  nextRunAt: istToUtc(v.date, v.time),
  repeatRule: v.repeatRule,
  repeatEveryDays: v.repeatRule === "CUSTOM_DAYS" ? Number(v.repeatEveryDays) : null,
  notes: orNull(v.notes),
  assetId: orNull(v.assetId),
  subscriptionId: orNull(v.subscriptionId),
  active: v.active,
  template:
    v.type === "RECURRING_TASK"
      ? ({ requesterId: v.ticketRequesterId, categoryId: orNull(v.ticketCategoryId), priority: v.ticketPriority } satisfies TicketTemplate)
      : Prisma.DbNull,
});

export const saveReminder = createAction({
  schema: reminderSaveSchema,
  handler: async ({ id, data }, { tx, audit, user }) => {
    if (!id) {
      const created = await tx.reminder.create({ data: { ...toData(data), createdById: user.id } });
      await audit({ action: "CREATE", entityType: "Reminder", entityId: created.id, entityLabel: created.title, after: created });
      return { id: created.id };
    }
    const before = await tx.reminder.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Reminder not found.");
    const after = await tx.reminder.update({ where: { id }, data: toData(data) });
    await audit({ action: "UPDATE", entityType: "Reminder", entityId: id, entityLabel: after.title, before, after });
    return { id };
  },
});

export const setReminderActive = createAction({
  schema: z.object({ id: z.string().min(1), active: z.boolean() }),
  handler: async ({ id, active }, { tx, audit }) => {
    const before = await tx.reminder.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Reminder not found.");
    const after = await tx.reminder.update({ where: { id }, data: { active } });
    await audit({ action: "UPDATE", entityType: "Reminder", entityId: id, entityLabel: after.title, before, after });
    return { id };
  },
});

export const archiveReminder = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ id }, { tx, audit }) => {
    const before = await tx.reminder.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ActionError("Reminder not found.");
    const after = await tx.reminder.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit({ action: "DELETE", entityType: "Reminder", entityId: id, entityLabel: before.title, before, after });
    return { id };
  },
});

/**
 * Runs the same job as /api/cron/reminders, on demand. Not wrapped in createAction: the job
 * manages its own writes and sends email, which shouldn't sit inside one long DB transaction.
 */
export async function runRemindersNow(): Promise<ActionResult<RunSummary>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!WRITE_ROLES.includes(user.role)) return { ok: false, error: "You don't have permission to do that." };
  try {
    const summary = await runReminders();
    refresh();
    return { ok: true, data: summary };
  } catch (e) {
    console.error("[reminders] manual run failed", e);
    return { ok: false, error: "The reminder job failed. Check the server log." };
  }
}
