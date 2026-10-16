"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormError, InputField, SelectField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { FormGrid } from "@/components/ui/field";
import { TICKET_PRIORITY, TICKET_SOURCE, toOptions } from "@/lib/options";
import { createTicket } from "./actions";
import type { TicketLookups } from "./queries";
import { ticketSchema, type TicketInput } from "./schema";
import { assetOptions, emptyTicket } from "./ticket-form";

export const QUICK_TICKET_EVENT = "itops:quick-ticket";

/** Open the quick-add modal from anywhere (menus, buttons). */
export function openQuickTicket(preset?: Partial<TicketInput>) {
  window.dispatchEvent(new CustomEvent(QUICK_TICKET_EVENT, { detail: preset ?? {} }));
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || !!target.closest("[role=dialog]");
}

/**
 * Global quick-add: press "N" anywhere (outside inputs/dialogs) or call openQuickTicket().
 * Only title + requester are required; everything else has sensible defaults.
 */
export function QuickTicket({ lookups, canWrite }: { lookups: TicketLookups; canWrite: boolean }) {
  const [preset, setPreset] = useState<Partial<TicketInput> | null>(null);

  useEffect(() => {
    if (!canWrite) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      setPreset({});
    };
    const onOpen = (e: Event) => setPreset((e as CustomEvent<Partial<TicketInput>>).detail ?? {});
    window.addEventListener("keydown", onKey);
    window.addEventListener(QUICK_TICKET_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(QUICK_TICKET_EVENT, onOpen);
    };
  }, [canWrite]);

  return (
    <Modal open={preset !== null} onOpenChange={(o) => !o && setPreset(null)} title="New ticket" description="Only the title and requester are required. Shortcut: N">
      {preset && <QuickForm lookups={lookups} preset={preset} onDone={() => setPreset(null)} />}
    </Modal>
  );
}

function QuickForm({ lookups, preset, onDone }: { lookups: TicketLookups; preset: Partial<TicketInput>; onDone: () => void }) {
  const router = useRouter();
  const openAfter = useRef(false);
  const { form, submit, pending, errors, formError } = useActionForm(ticketSchema, createTicket, {
    defaultValues: emptyTicket(preset),
    onSuccess: (r) => {
      onDone();
      if (openAfter.current) router.push(`/tickets/${r.id}`);
      else toast.success(`${r.ticketNumber} created`, { action: { label: "Open", onClick: () => router.push(`/tickets/${r.id}`) } });
    },
  });
  const r = form.register;
  const requesterId = useWatch({ control: form.control, name: "requesterId" });
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormError message={formError} />
      <InputField label="Title" required autoFocus placeholder="Laptop not charging" error={errors.title?.message} {...r("title")} />
      <FormGrid>
        <SelectField
          label="Requester"
          required
          placeholder="Who is it for?"
          options={lookups.employees.map((e) => ({ value: e.id, label: e.name }))}
          error={errors.requesterId?.message}
          {...r("requesterId")}
        />
        <SelectField label="Category" placeholder="—" options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))} {...r("categoryId")} />
        <SelectField label="Priority" options={toOptions(TICKET_PRIORITY)} {...r("priority")} />
        <SelectField label="Source" options={toOptions(TICKET_SOURCE)} {...r("source")} />
        <SelectField label="Asset" placeholder="—" options={assetOptions(lookups.assets, requesterId)} {...r("assetId")} />
        <InputField label="Due date" type="date" {...r("dueDate")} />
      </FormGrid>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button
          type="submit"
          disabled={pending}
          onClick={() => {
            openAfter.current = true;
          }}
        >
          Create & open
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          onClick={() => {
            openAfter.current = false;
          }}
        >
          {pending ? "Creating…" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}

/** Small client button for server-rendered pages (dashboard, employee page…). */
export function NewTicketButton({ preset, label = "+ Ticket", variant = "secondary" }: { preset?: Partial<TicketInput>; label?: string; variant?: "primary" | "secondary" }) {
  return (
    <Button size="sm" variant={variant} onClick={() => openQuickTicket(preset)}>
      {label}
    </Button>
  );
}
