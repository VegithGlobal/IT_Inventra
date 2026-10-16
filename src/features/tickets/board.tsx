"use client";

import { CalendarClock, MessageSquare, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { PriorityDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { formatDateTime } from "@/lib/format";
import { TICKET_PRIORITY, TICKET_STATUS, formatAge } from "@/lib/options";
import { cn } from "@/lib/utils";
import { changeTicketStatus } from "./actions";
import type { TicketRow } from "./queries";
import { TICKET_STATUSES, type TicketStatusKey } from "./schema";

const DONE_WINDOW_DAYS = 14;
const dueFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function TicketCard({ t, canWrite, onMove, dragging, setDragging }: { t: TicketRow; canWrite: boolean; onMove: (s: TicketStatusKey) => void; dragging: boolean; setDragging: (id: string | null) => void }) {
  return (
    <article
      draggable={canWrite}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(t.id);
      }}
      onDragEnd={() => setDragging(null)}
      className={cn(
        "group relative rounded-lg border border-line bg-surface p-3 transition-[box-shadow,transform,opacity] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-popover)]",
        canWrite && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        <PriorityDot priority={t.priority} />
        <span className="font-mono text-[11.5px] text-fg-muted">{t.ticketNumber}</span>
        <span className="sr-only">{TICKET_PRIORITY[t.priority]} priority</span>
        {canWrite && (
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Move ${t.ticketNumber}`} className="relative z-10 -my-1 ml-auto size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Move to</MenuLabel>
              {TICKET_STATUSES.filter((s) => s !== t.status).map((s) => (
                <MenuItem key={s} onSelect={() => onMove(s)}>
                  {TICKET_STATUS[s].label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
      <Link href={`/tickets/${t.id}`} draggable={false} className="mt-1.5 line-clamp-2 block text-[13.5px] leading-snug font-medium text-fg after:absolute after:inset-0 hover:underline">
        {t.title}
      </Link>
      <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-muted">
        <Avatar name={t.requester} size="xs" />
        <span className="min-w-0 flex-1 truncate">{t.requester}</span>
        {t.comments > 0 && (
          <span className="flex items-center gap-0.5" aria-label={`${t.comments} comments`}>
            <MessageSquare className="size-3" /> {t.comments}
          </span>
        )}
        {t.dueDate && t.status !== "RESOLVED" && t.status !== "CLOSED" ? (
          <span className={cn("flex items-center gap-1", t.overdue && "font-medium text-danger")} title={`Due ${formatDateTime(t.dueDate)}`}>
            <CalendarClock className="size-3" />
            {dueFmt.format(new Date(t.dueDate))}
          </span>
        ) : (
          <span title="Age">{formatAge(t.createdAt)}</span>
        )}
      </div>
      {t.asset && <span className="relative mt-2 inline-block rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-secondary">{t.asset}</span>}
    </article>
  );
}

export function TicketBoard({ rows, canWrite }: { rows: TicketRow[]; canWrite: boolean }) {
  const [, startTransition] = useTransition();
  const [optimistic, move] = useOptimistic(rows, (state, { id, status }: { id: string; status: TicketStatusKey }) => state.map((t) => (t.id === id ? { ...t, status } : t)));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TicketStatusKey | null>(null);

  // Just-dropped cards stay visible; older resolved/closed ones are trimmed server-side.
  const visible = optimistic.filter((t) => !(t.status === "RESOLVED" || t.status === "CLOSED") || t.recentlyDone || rows.find((r) => r.id === t.id)?.status !== t.status);

  function moveTo(id: string, status: TicketStatusKey) {
    const t = optimistic.find((x) => x.id === id);
    if (!t || t.status === status) return;
    startTransition(async () => {
      move({ id, status });
      const res = await changeTicketStatus({ id, status });
      if (!res.ok) toast.error(res.error);
      else toast.success(`${t.ticketNumber} → ${TICKET_STATUS[status].label}`);
    });
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
      <div className="grid min-w-[1180px] grid-cols-6 gap-3">
        {TICKET_STATUSES.map((status) => {
          const items = visible
            .filter((t) => t.status === status)
            .sort((a, b) => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(b.priority) || b.seq - a.seq);
          return (
            <section
              key={status}
              aria-label={TICKET_STATUS[status].label}
              onDragOver={(e) => {
                if (!canWrite) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                // The card remounts in its new column, so its own dragend never fires.
                setDragging(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveTo(id, status);
              }}
              className={cn("flex min-h-[60vh] flex-col rounded-xl bg-subtle/60 p-2 transition-colors duration-150", over === status && "bg-brand-soft ring-2 ring-brand/40")}
            >
              <header className="flex items-center justify-between px-1.5 pt-1 pb-2.5">
                <h3 className="text-[12px] font-medium tracking-[0.04em] text-fg-muted uppercase">{TICKET_STATUS[status].label}</h3>
                <span className="rounded-full bg-surface px-1.5 text-[11.5px] text-fg-secondary tabular">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2">
                {items.map((t) => (
                  <TicketCard key={t.id} t={t} canWrite={canWrite} dragging={dragging === t.id} setDragging={setDragging} onMove={(s) => moveTo(t.id, s)} />
                ))}
                {items.length === 0 && <p className="px-2 py-6 text-center text-[12.5px] text-fg-muted">{canWrite ? "Drop tickets here" : "Empty"}</p>}
              </div>
              {(status === "RESOLVED" || status === "CLOSED") && <p className="mt-auto px-1.5 pt-3 text-[11.5px] text-fg-muted">Last {DONE_WINDOW_DAYS} days</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
