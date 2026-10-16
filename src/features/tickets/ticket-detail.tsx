"use client";

import { Archive, CheckCircle2, ChevronDown, Paperclip, RotateCcw, Send, Timer } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { FormError, InputField, TextareaField, useActionForm, useActionRunner } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { TICKET_STATUS, formatMinutes } from "@/lib/options";
import { addTicketAttachment, addTicketComment, archiveTicket, changeTicketStatus, logTicketTime } from "./actions";
import type { TicketLookups } from "./queries";
import { TICKET_STATUSES, type TicketInput, type TicketStatusKey } from "./schema";
import { TicketForm } from "./ticket-form";

const resolveSchema = z.object({
  resolutionNotes: z.string().trim().min(1, "Add a short note on what fixed it").max(8000),
  addMinutes: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 100_000), "Minutes as a whole number"),
});

function ResolveDialog({ id, open, onOpenChange, status }: { id: string; open: boolean; onOpenChange: (o: boolean) => void; status: "RESOLVED" | "CLOSED" }) {
  const { form, submit, pending, errors, formError } = useActionForm(resolveSchema, (v) => changeTicketStatus({ id, status, resolutionNotes: v.resolutionNotes, addMinutes: v.addMinutes }), {
    defaultValues: { resolutionNotes: "", addMinutes: "" },
    successMessage: status === "CLOSED" ? "Ticket closed" : "Ticket resolved",
    onSuccess: () => onOpenChange(false),
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={status === "CLOSED" ? "Close ticket" : "Resolve ticket"} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={formError} />
        <TextareaField label="Resolution" required rows={4} autoFocus placeholder="Replaced the charger; tested OK." error={errors.resolutionNotes?.message} {...form.register("resolutionNotes")} />
        <InputField label="Add time spent (minutes)" inputMode="numeric" placeholder="20" error={errors.addMinutes?.message} {...form.register("addMinutes")} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : status === "CLOSED" ? "Close ticket" : "Resolve"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TicketActions({
  id,
  status,
  initial,
  lookups,
  hasAsset,
  onSendToRepair,
}: {
  id: string;
  status: TicketStatusKey;
  initial: TicketInput;
  lookups: TicketLookups;
  hasAsset: boolean;
  onSendToRepair?: ReactNode;
}) {
  const [resolving, setResolving] = useState<"RESOLVED" | "CLOSED" | null>(null);
  const { pending, run } = useActionRunner();
  const done = status === "RESOLVED" || status === "CLOSED";
  return (
    <>
      <ConfirmAction
        action={archiveTicket}
        input={{ id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive ticket?"
        description="It disappears from boards and lists. Its history stays in the audit log."
        confirmLabel="Archive"
        successMessage="Ticket archived"
        redirectTo="/tickets"
        danger
      />
      {hasAsset && onSendToRepair}
      <EditSheet title="Edit ticket">{(close) => <TicketForm id={id} initial={initial} lookups={lookups} onDone={close} />}</EditSheet>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" disabled={pending}>
            {TICKET_STATUS[status].label}
            <ChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>Set status</MenuLabel>
          {TICKET_STATUSES.filter((s) => s !== status).map((s) => (
            <MenuItem key={s} onSelect={() => (s === "RESOLVED" || s === "CLOSED" ? setResolving(s) : run(() => changeTicketStatus({ id, status: s }), `Moved to ${TICKET_STATUS[s].label}`))}>
              {TICKET_STATUS[s].label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {done ? (
        <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => changeTicketStatus({ id, status: "OPEN" }), "Ticket reopened")}>
          <RotateCcw />
          Reopen
        </Button>
      ) : (
        <Button size="sm" variant="primary" onClick={() => setResolving("RESOLVED")}>
          <CheckCircle2 />
          Resolve
        </Button>
      )}
      <ResolveDialog id={id} open={!!resolving} status={resolving ?? "RESOLVED"} onOpenChange={(o) => !o && setResolving(null)} />
    </>
  );
}

/** Comment box with an attach button underneath the timeline. */
export function CommentBox({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, run } = useActionRunner();

  function send() {
    if (file) {
      const fd = new FormData();
      fd.set("ticketId", ticketId);
      fd.set("file", file);
      fd.set("note", body.trim() ? body.trim().slice(0, 500) : "");
      run(() => addTicketAttachment(fd), "File attached", () => {
        setFile(null);
        setBody("");
        if (fileRef.current) fileRef.current.value = "";
      });
      return;
    }
    if (!body.trim()) return;
    run(() => addTicketComment({ ticketId, body }), undefined, () => setBody(""));
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 focus-within:border-fg focus-within:ring-[3px] focus-within:ring-fg/[0.06]">
      <label htmlFor="comment" className="sr-only">
        Add a comment
      </label>
      <Textarea
        id="comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={file ? "Optional caption for the attachment" : "Add a comment… (Ctrl+Enter to send)"}
        className="min-h-16 border-0 p-1 focus:ring-0"
      />
      <div className="mt-2 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" id="ticket-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button size="sm" variant="ghost" asChild>
          <label htmlFor="ticket-file" className="cursor-pointer">
            <Paperclip />
            {file ? <span className="max-w-48 truncate">{file.name}</span> : "Attach"}
          </label>
        </Button>
        <Button size="sm" variant="primary" className="ml-auto" disabled={pending || (!body.trim() && !file)} onClick={send}>
          <Send />
          {file ? "Upload" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

export function TimeLogger({ id, minutes }: { id: string; minutes: number }) {
  const { pending, run } = useActionRunner();
  const [custom, setCustom] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[13.5px] text-fg">
        <Timer className="size-4 text-fg-muted" /> {formatMinutes(minutes)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {[15, 30, 60].map((m) => (
          <Button key={m} size="sm" disabled={pending} onClick={() => run(() => logTicketTime({ id, minutes: m }))}>
            +{m < 60 ? `${m}m` : "1h"}
          </Button>
        ))}
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && Number.isInteger(Number(custom)) && Number(custom) !== 0) {
              run(() => logTicketTime({ id, minutes: Number(custom) }), undefined, () => setCustom(""));
            }
          }}
          placeholder="min ↵"
          aria-label="Add custom minutes (press Enter)"
          className="h-8 w-20"
        />
      </div>
    </div>
  );
}

