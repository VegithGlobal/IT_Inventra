"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationsRead } from "./actions";
import { NOTIFICATION_META, relativeTime } from "./meta";
import type { NotificationRow } from "./queries";

type Item = Pick<NotificationRow, "id" | "type" | "title" | "body" | "href" | "readAt" | "createdAt">;

/** Bell with unread badge; popover shows the latest notifications. */
export function BellView({ unread, latest }: { unread: number; latest: Item[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pending, run } = useActionRunner();

  // Pick up notifications created by the scheduler without a full reload.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-action-fg tabular">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[14px] font-semibold text-fg">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markAllNotificationsRead({}))}
              className="flex items-center gap-1 text-[12.5px] font-medium text-fg-secondary hover:text-fg"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-fg-muted">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {latest.map((n) => {
              const meta = NOTIFICATION_META[n.type];
              const Icon = meta.icon;
              return (
                <li key={n.id} className="border-b border-line last:border-0">
                  <Link
                    href={n.href ?? "/notifications"}
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) run(() => markNotificationsRead({ ids: [n.id], read: true }));
                    }}
                    className="flex gap-3 px-4 py-3 hover:bg-subtle"
                  >
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle", !n.readAt && "bg-brand-soft")}>
                      <Icon className={cn("size-3.5 text-fg-muted", !n.readAt && "text-brand-text")} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[13px] leading-snug", n.readAt ? "text-fg-secondary" : "font-medium text-fg")}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-[12px] text-fg-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[11.5px] text-fg-muted">{relativeTime(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-fg-secondary hover:bg-subtle hover:text-fg">
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
