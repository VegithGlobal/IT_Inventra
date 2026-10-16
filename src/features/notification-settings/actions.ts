"use server";

import { createAction, type ActionResult } from "@/lib/action";
import { digestHtml, emailConfigured, sendEmail } from "@/lib/email";
import { getCurrentUser, WRITE_ROLES } from "@/lib/session";
import type { Tx } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { emailSettingsSchema, parseDayList, reminderSettingsSchema } from "./schema";

async function saveSetting(tx: Tx, key: string, value: Prisma.InputJsonObject) {
  const before = await tx.setting.findUnique({ where: { key } });
  const after = await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  return { before, after };
}

export const saveReminderSettings = createAction({
  schema: reminderSettingsSchema,
  roles: ["ADMIN"],
  handler: async (v, { tx, audit }) => {
    const { before, after } = await saveSetting(tx, "reminders", {
      subscriptionDaysBefore: parseDayList(v.subscriptionDaysBefore),
      warrantyDaysBefore: Number(v.warrantyDaysBefore),
      licenseDaysBefore: parseDayList(v.licenseDaysBefore),
      ticketDueHoursBefore: Number(v.ticketDueHoursBefore),
      assetReturnDaysBefore: Number(v.assetReturnDaysBefore),
    });
    await audit({ action: before ? "UPDATE" : "CREATE", entityType: "Setting", entityId: after.id, entityLabel: "Reminder defaults", before: before?.value, after: after.value });
    return { ok: true };
  },
});

export const saveEmailSettings = createAction({
  schema: emailSettingsSchema,
  roles: ["ADMIN"],
  handler: async (v, { tx, audit }) => {
    const { before, after } = await saveSetting(tx, "emailNotifications", v);
    await audit({ action: before ? "UPDATE" : "CREATE", entityType: "Setting", entityId: after.id, entityLabel: "Email notifications", before: before?.value, after: after.value });
    return { ok: true };
  },
});

/** Sends a test email to the signed-in user. Plain action: no DB writes, network I/O only. */
export async function sendTestEmail(): Promise<ActionResult<{ to: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (!WRITE_ROLES.includes(user.role)) return { ok: false, error: "You don't have permission to do that." };
  if (!emailConfigured()) return { ok: false, error: "SMTP isn't configured. Set SMTP_HOST (and credentials) in .env, then restart the server." };
  try {
    await sendEmail({
      to: user.email,
      subject: "IT Ops Hub test email",
      text: "SMTP is working. Reminder emails will arrive from this address.",
      html: digestHtml({
        heading: "SMTP is working",
        intro: `Hi ${user.name.split(" ")[0]}, this is a test from IT Ops Hub.`,
        items: [{ title: "Reminder emails will arrive from this address.", body: "Choose which reminder types are emailed under Settings → Notifications." }],
        footer: "Sent because someone clicked “Send test email”.",
      }),
    });
    return { ok: true, data: { to: user.email } };
  } catch (e) {
    return { ok: false, error: `Sending failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
