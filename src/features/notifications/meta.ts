import { AlarmClock, Bell, CalendarClock, CircleAlert, KeyRound, PackageMinus, ShieldCheck, Ticket, Undo2, UserX, Wrench, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/badge";
import type { NotificationType } from "@/generated/prisma/enums";

export const NOTIFICATION_META: Record<NotificationType, { label: string; icon: LucideIcon; tone: Tone }> = {
  SUBSCRIPTION_DUE: { label: "Subscription due", icon: CalendarClock, tone: "brand" },
  PAYMENT_OVERDUE: { label: "Payment overdue", icon: CircleAlert, tone: "danger" },
  WARRANTY_EXPIRY: { label: "Warranty expiry", icon: ShieldCheck, tone: "warning" },
  LICENSE_EXPIRY: { label: "License expiry", icon: KeyRound, tone: "warning" },
  LOW_STOCK: { label: "Low stock", icon: PackageMinus, tone: "warning" },
  TICKET_DUE: { label: "Ticket due", icon: Ticket, tone: "info" },
  ASSET_RETURN_DUE: { label: "Asset return", icon: Undo2, tone: "info" },
  MAINTENANCE_DUE: { label: "Maintenance", icon: Wrench, tone: "warning" },
  ACCOUNT_OFFBOARDING: { label: "Account offboarding", icon: UserX, tone: "danger" },
  REMINDER: { label: "Reminder", icon: AlarmClock, tone: "neutral" },
  SYSTEM: { label: "System", icon: Bell, tone: "neutral" },
};

/** "5m", "3h", "2d", or a date for older items. */
export function relativeTime(date: Date | string, now = Date.now()) {
  const mins = Math.round((now - new Date(date).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(date));
}
