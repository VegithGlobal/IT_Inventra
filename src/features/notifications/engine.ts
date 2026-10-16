import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import { daysBetween, HOUR_MS, istDateOf, addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { digestHtml, emailConfigured, sendEmail } from "@/lib/email";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { nextOccurrenceAfter } from "@/lib/repeat";
import { getEmailSettings, getReminderSettings, type ReminderSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import type { TicketTemplate } from "@/features/reminders/schema";
import { createTicketRecord } from "@/features/tickets/server";

/**
 * Reminder engine. Scans the data, emits notification "events", and stores one Notification per
 * (event, recipient). Every event carries a stable key, and Notification.dedupeKey is unique, so
 * running this hourly, daily or twice by accident never produces duplicates. Thresholds are
 * "crossed" rather than "equal", so a missed run still sends the reminder the next time.
 */

export type ReminderEvent = { type: NotificationType; key: string; title: string; body?: string; href?: string };

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const inDays = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Smallest configured offset that daysLeft has reached (e.g. offsets 7/3/1/0, 5 days left → 7). */
export function crossedThreshold(daysLeft: number, offsets: number[]): number | null {
  const reached = offsets.filter((o) => daysLeft <= o);
  return reached.length ? Math.min(...reached) : null;
}

async function subscriptionEvents(today: Date, s: ReminderSettings): Promise<ReminderEvent[]> {
  const subs = await db.subscription.findMany({
    where: { deletedAt: null, status: "ACTIVE", nextDueDate: { lte: addDays(today, Math.max(...s.subscriptionDaysBefore, 0)) } },
    include: { vendor: { select: { name: true } } },
  });
  const out: ReminderEvent[] = [];
  for (const sub of subs) {
    const days = daysBetween(today, sub.nextDueDate);
    const body = `${formatMoney(sub.amount, sub.currency)}${sub.vendor ? ` · ${sub.vendor.name}` : ""} · due ${formatDate(sub.nextDueDate)}`;
    const href = `/subscriptions/${sub.id}`;
    if (days < 0) {
      // Overdue: on the first day, then once a week until paid.
      const week = Math.floor((-days - 1) / 7);
      out.push({ type: "PAYMENT_OVERDUE", key: `sub-overdue:${sub.id}:${iso(sub.nextDueDate)}:w${week}`, title: `${sub.name} is overdue by ${plural(-days, "day")}`, body, href });
      continue;
    }
    const offsets = Array.isArray(sub.reminderDays) ? (sub.reminderDays as number[]) : s.subscriptionDaysBefore;
    const t = crossedThreshold(days, offsets);
    if (t === null) continue;
    out.push({ type: "SUBSCRIPTION_DUE", key: `sub-due:${sub.id}:${iso(sub.nextDueDate)}:${t}`, title: `${sub.name} is due ${inDays(days)}`, body, href });
  }
  return out;
}

async function warrantyEvents(today: Date, s: ReminderSettings): Promise<ReminderEvent[]> {
  const assets = await db.asset.findMany({
    where: { deletedAt: null, status: { notIn: ["RETIRED", "DISPOSED", "LOST_STOLEN"] }, warrantyEnd: { gte: today, lte: addDays(today, s.warrantyDaysBefore) } },
    include: { currentHolder: { select: { name: true } } },
  });
  return assets.map((a) => {
    const days = daysBetween(today, a.warrantyEnd!);
    return {
      type: "WARRANTY_EXPIRY",
      key: `warranty:${a.id}:${iso(a.warrantyEnd!)}`,
      title: `${a.assetTag} warranty ends ${inDays(days)}`,
      body: `${a.name}${a.currentHolder ? ` · with ${a.currentHolder.name}` : ""} · ends ${formatDate(a.warrantyEnd)}`,
      href: `/assets/${a.id}`,
    };
  });
}

async function licenseEvents(today: Date, s: ReminderSettings): Promise<ReminderEvent[]> {
  const offsets = [...new Set([...s.licenseDaysBefore, 0])];
  const licenses = await db.license.findMany({
    where: { deletedAt: null, expiryDate: { not: null, lte: addDays(today, Math.max(...offsets)) } },
  });
  const out: ReminderEvent[] = [];
  for (const l of licenses) {
    const days = daysBetween(today, l.expiryDate!);
    const body = `${plural(l.totalSeats, "seat")} · expires ${formatDate(l.expiryDate)}`;
    if (days < 0) {
      out.push({ type: "LICENSE_EXPIRY", key: `license-expired:${l.id}:${iso(l.expiryDate!)}`, title: `${l.name} license has expired`, body, href: "/licenses" });
      continue;
    }
    const t = crossedThreshold(days, offsets);
    if (t !== null) out.push({ type: "LICENSE_EXPIRY", key: `license:${l.id}:${iso(l.expiryDate!)}:${t}`, title: `${l.name} license expires ${inDays(days)}`, body, href: "/licenses" });
  }
  return out;
}

async function lowStockEvents(): Promise<ReminderEvent[]> {
  const items = await db.inventoryItem.findMany({ where: { deletedAt: null } });
  return items
    .filter((i) => i.quantity <= i.minQuantity)
    .map((i) => ({
      type: "LOW_STOCK" as const,
      // Re-notifies if the quantity changes while still low; silent while unchanged.
      key: `low-stock:${i.id}:${i.quantity}`,
      title: i.quantity === 0 ? `${i.name} is out of stock` : `${i.name} is low on stock`,
      body: `${i.quantity} ${i.unit} left · reorder point ${i.minQuantity}`,
      href: "/inventory",
    }));
}

async function ticketEvents(now: Date, s: ReminderSettings): Promise<ReminderEvent[]> {
  const tickets = await db.ticket.findMany({
    where: { deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] }, dueDate: { not: null, lte: new Date(now.getTime() + s.ticketDueHoursBefore * HOUR_MS) } },
    include: { requester: { select: { name: true } } },
  });
  return tickets.map((t) => {
    const overdue = t.dueDate! <= now;
    return {
      type: "TICKET_DUE" as const,
      key: `${overdue ? "ticket-overdue" : "ticket-due"}:${t.id}:${t.dueDate!.toISOString()}`,
      title: `${t.ticketNumber} ${overdue ? "is overdue" : "is due soon"}: ${t.title}`,
      body: `For ${t.requester.name} · due ${formatDateTime(t.dueDate)}`,
      href: `/tickets/${t.id}`,
    };
  });
}

async function assetReturnEvents(today: Date, s: ReminderSettings): Promise<ReminderEvent[]> {
  const open = await db.assetAssignment.findMany({
    where: { returnedAt: null, expectedReturnAt: { not: null, lte: addDays(today, s.assetReturnDaysBefore) }, asset: { deletedAt: null } },
    include: { asset: { select: { id: true, assetTag: true, name: true } }, employee: { select: { name: true } } },
  });
  return open.map((a) => {
    const days = daysBetween(today, a.expectedReturnAt!);
    const base = { type: "ASSET_RETURN_DUE" as const, body: `${a.asset.name} · expected back ${formatDate(a.expectedReturnAt)}`, href: `/assets/${a.asset.id}` };
    return days < 0
      ? { ...base, key: `return-overdue:${a.id}:${iso(a.expectedReturnAt!)}:w${Math.floor((-days - 1) / 7)}`, title: `${a.asset.assetTag} return from ${a.employee.name} is ${plural(-days, "day")} overdue` }
      : { ...base, key: `return-due:${a.id}:${iso(a.expectedReturnAt!)}`, title: `${a.asset.assetTag} is due back from ${a.employee.name} ${inDays(days)}` };
  });
}

async function maintenanceEvents(today: Date): Promise<ReminderEvent[]> {
  const open = await db.maintenanceRecord.findMany({
    where: { deletedAt: null, status: "OPEN", expectedReturnAt: { not: null, lt: today } },
    include: { asset: { select: { id: true, assetTag: true } }, vendor: { select: { name: true } } },
  });
  return open.map((m) => {
    const late = daysBetween(m.expectedReturnAt!, today);
    return {
      type: "MAINTENANCE_DUE" as const,
      key: `repair-late:${m.id}:${iso(m.expectedReturnAt!)}:w${Math.floor((late - 1) / 7)}`,
      title: `${m.asset.assetTag} is ${plural(late, "day")} late back from repair`,
      body: `${m.issue}${m.vendor ? ` · ${m.vendor.name}` : ""}`,
      href: `/assets/${m.asset.id}`,
    };
  });
}

/** Custom / recurring reminders whose time has come. Advances repeating ones (once, even if long overdue). */
async function customReminderEvents(now: Date, dryRun: boolean): Promise<ReminderEvent[]> {
  const due = await db.reminder.findMany({ where: { deletedAt: null, active: true, nextRunAt: { lte: now } } });
  const out: ReminderEvent[] = [];
  for (const r of due) {
    const event: ReminderEvent = {
      type: r.type === "PREVENTIVE_MAINTENANCE" ? "MAINTENANCE_DUE" : "REMINDER",
      key: `reminder:${r.id}:${r.nextRunAt.toISOString()}`,
      title: r.type === "RECURRING_TASK" ? `Recurring task: ${r.title}` : r.title,
      body: r.notes ?? `Scheduled for ${formatDateTime(r.nextRunAt)}`,
      href: r.assetId ? `/assets/${r.assetId}` : r.subscriptionId ? `/subscriptions/${r.subscriptionId}` : "/reminders",
    };
    if (dryRun) {
      out.push(event);
      continue;
    }
    const next = nextOccurrenceAfter(r.nextRunAt, r.repeatRule, r.repeatEveryDays, now);
    const template = r.type === "RECURRING_TASK" ? ((r.template ?? null) as Partial<TicketTemplate> | null) : null;
    const opened = await db.$transaction(async (tx) => {
      // Conditional on nextRunAt so two overlapping runs can't both advance it (or open two tickets).
      const { count } = await tx.reminder.updateMany({
        where: { id: r.id, nextRunAt: r.nextRunAt },
        data: { lastTriggeredAt: now, ...(next ? { nextRunAt: next } : { active: false }) },
      });
      if (count === 0 || !template?.requesterId) return null;
      const requester = await tx.employee.findFirst({ where: { id: template.requesterId, deletedAt: null } });
      if (!requester) return null;
      const ticket = await createTicketRecord(
        tx,
        {
          title: r.title,
          description: r.notes,
          requesterId: requester.id,
          categoryId: template.categoryId ?? null,
          priority: template.priority ?? "MEDIUM",
          source: "SELF_IDENTIFIED",
          assetId: r.assetId,
          dueDate: new Date(now.getTime() + 24 * HOUR_MS),
          reminderId: r.id,
        },
        "Created automatically by a recurring task",
      );
      await writeAudit(tx, null, { action: "CREATE", entityType: "Ticket", entityId: ticket.id, entityLabel: `${ticket.ticketNumber} · ${ticket.title} (recurring task)`, after: ticket });
      return ticket;
    });
    out.push(opened ? { ...event, title: `${event.title} → ${opened.ticketNumber} opened`, href: `/tickets/${opened.id}` } : event);
  }
  return out;
}

export async function collectEvents(now: Date, opts: { dryRun?: boolean } = {}) {
  const settings = await getReminderSettings();
  const today = istDateOf(now);
  const groups = await Promise.all([
    subscriptionEvents(today, settings),
    warrantyEvents(today, settings),
    licenseEvents(today, settings),
    lowStockEvents(),
    ticketEvents(now, settings),
    assetReturnEvents(today, settings),
    maintenanceEvents(today),
  ]);
  // Custom reminders mutate state, so they run after the read-only scans.
  groups.push(await customReminderEvents(now, !!opts.dryRun));
  return groups.flat();
}

export type RunSummary = { events: number; created: number; recipients: number; emailed: number; emailSkipped: string | null; errors: string[] };

export async function runReminders(opts: { now?: Date } = {}): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const events = await collectEvents(now);
  const users = await db.user.findMany({ where: { active: true, deletedAt: null, role: { in: ["ADMIN", "IT_STAFF"] } }, select: { id: true, name: true, email: true } });

  const { count: created } = await db.notification.createMany({
    data: events.flatMap((e) =>
      users.map((u) => ({ userId: u.id, type: e.type, title: e.title, body: e.body ?? null, href: e.href ?? null, dedupeKey: `${e.key}:u:${u.id}` })),
    ),
    skipDuplicates: true,
  });

  const summary: RunSummary = { events: events.length, created, recipients: users.length, emailed: 0, emailSkipped: null, errors: [] };
  if (!emailConfigured()) {
    summary.emailSkipped = "SMTP not configured";
    return summary;
  }

  // Email digest: unread, un-emailed notifications from the last day, for enabled types only.
  const enabled = await getEmailSettings();
  const types = (Object.keys(enabled) as (keyof typeof enabled)[]).filter((t) => enabled[t]);
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  for (const u of users) {
    const pending = await db.notification.findMany({
      where: { userId: u.id, emailedAt: null, readAt: null, type: { in: types }, createdAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) } },
      orderBy: { createdAt: "asc" },
    });
    if (!pending.length) continue;
    try {
      await sendEmail({
        to: u.email,
        subject: pending.length === 1 ? pending[0].title : `IT Ops Hub: ${pending.length} reminders`,
        text: pending.map((n) => `• ${n.title}${n.body ? `\n  ${n.body}` : ""}${n.href ? `\n  ${base}${n.href}` : ""}`).join("\n\n"),
        html: digestHtml({
          heading: pending.length === 1 ? "You have 1 reminder" : `You have ${pending.length} reminders`,
          intro: `Hi ${u.name.split(" ")[0]}, here's what needs attention.`,
          items: pending.map((n) => ({ title: n.title, body: n.body, url: n.href ? `${base}${n.href}` : null })),
          footer: "Sent by IT Ops Hub. Change which reminders are emailed under Settings → Notifications.",
        }),
      });
      await db.notification.updateMany({ where: { id: { in: pending.map((n) => n.id) } }, data: { emailedAt: now } });
      summary.emailed += pending.length;
    } catch (e) {
      summary.errors.push(`Email to ${u.email} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return summary;
}
